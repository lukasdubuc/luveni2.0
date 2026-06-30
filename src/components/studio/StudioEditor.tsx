import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { Stage, Layer, Image as KImage, Text as KText, Rect, Transformer, Group } from "react-konva";
import Konva from "konva";
import {
  Type, ImagePlus, Sparkles, Trash2, Eye, EyeOff, ArrowUp, ArrowDown,
  Save, Download, Loader2, Wand2, X, RefreshCw, Undo2, Redo2, SquareDashed,
  Paintbrush, FlipHorizontal2, FlipVertical2, MousePointer2, PaintBucket,
  AlignCenterHorizontal, AlignCenterVertical, AlignVerticalJustifyCenter, Layers, Plus,
  Maximize2, Minimize2, Box, Shirt, Wrench, Eraser, Palette, Grid
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeRetailCents } from "@/lib/pricing";

const Garment3DPreview = lazy(() => import("./Garment3DPreview"));
const PrintfulDesignMaker = lazy(() => import("./PrintfulDesignMaker"));

export type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten";

export type StudioLayer = {
  id: string; type: "image" | "text" | "paint"; name: string; visible: boolean;
  x: number; y: number; rotation: number; opacity: number;
  src?: string; width?: number; height?: number;
  text?: string; fontSize?: number; fill?: string; fontStyle?: string; fontFamily?: string;
  blend?: BlendMode;
  clip?: boolean;   
  blur?: number;    
  reference?: boolean; 
};

const getProxyImageUrl = (url: string | null): string => {
  if (!url) return "";
  if (url.includes("files.cdn.printful.com") || url.includes("apliiq.com")) {
    const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL || "";
    if (supabaseUrl) {
      return `${supabaseUrl}/functions/v1/proxy-image?url=${encodeURIComponent(url)}`;
    }
  }
  return url;
};

function useBlur(getNode: () => Konva.Node | null, radius: number, dep: any) {
  useEffect(() => {
    const n = getNode(); if (!n) return;
    try {
      if (radius > 0) {
        n.cache(); n.filters([Konva.Filters.Blur]); (n as any).blurRadius(radius);
      } else {
        n.filters([]); n.clearCache();
      }
      n.getLayer()?.batchDraw();
    } catch { /* node not ready */ }
  }, [radius, dep]);
}

const gco = (l: StudioLayer) => (l.clip ? "source-atop" : (l.blend || "source-over"));

const BLENDS: BlendMode[] = ["source-over", "multiply", "screen", "overlay", "darken", "lighten"];
const BLEND_LABEL: Record<BlendMode, string> = { "source-over": "Normal", multiply: "Multiply", screen: "Screen", overlay: "Overlay", darken: "Darken", lighten: "Lighten" };

type Props = {
  projectId: string;
  initialCanvas: { layers?: StudioLayer[] } | null;
  artboardW: number; artboardH: number; templateKey: string;
  templateImage?: string | null; canvasKind?: string;
  projectName: string; priceCents: number;
  printArea?: { x: number; y: number; w: number; h: number } | null;
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
    im.src = src.includes("?") ? `${src}&cors=1` : `${src}?cors=1`;
    im.onload = () => setImg(im);
    im.onerror = () => setImg(null);
  }, [src]);
  return img;
}

function ImageNode({ layer, onChange, onSelect, onDragMove, nodeRef, listening }: any) {
  const img = useHtmlImage(layer.src);
  const innerRef = useRef<Konva.Image>(null);
  useBlur(() => innerRef.current, layer.blur || 0, [img, layer.blur, layer.width, layer.height]);
  if (!layer.visible) return null;
  return (
    <KImage
      ref={(n: any) => { innerRef.current = n; if (nodeRef) nodeRef(n); }} image={img || undefined}
      x={layer.x} y={layer.y} width={layer.width} height={layer.height}
      rotation={layer.rotation} opacity={layer.opacity}
      globalCompositeOperation={gco(layer)}
      draggable={listening} listening={listening}
      onClick={onSelect} onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const n = e.target as Konva.Image; const sx = n.scaleX(); const sy = n.scaleY();
        n.scaleX(1); n.scaleY(1);
        onChange({ x: n.x(), y: n.y(), width: Math.max(10, n.width() * sx), height: Math.max(10, n.height() * sy), rotation: n.rotation() });
      }}
    />
  );
}

function TextNode({ layer, onChange, onSelect, onDragMove, nodeRef, listening }: any) {
  if (!layer.visible) return null;
  return (
    <KText
      ref={nodeRef} text={layer.text}
      x={layer.x} y={layer.y} fontSize={layer.fontSize} fill={layer.fill}
      fontStyle={layer.fontStyle} fontFamily={layer.fontFamily || "Space Mono"}
      rotation={layer.rotation} opacity={layer.opacity}
      globalCompositeOperation={gco(layer)}
      draggable={listening} listening={listening}
      onClick={onSelect} onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const n = e.target as Konva.Text; const sx = n.scaleX();
        n.scaleX(1); n.scaleY(1);
        onChange({ x: n.x(), y: n.y(), fontSize: Math.max(6, (layer.fontSize || 48) * sx), rotation: n.rotation() });
      }}
    />
  );
}

function PaintNode({ layer, canvas }: any) {
  const innerRef = useRef<Konva.Image>(null);
  useBlur(() => innerRef.current, layer.blur || 0, [layer.blur]);
  if (!layer.visible || !canvas) return null;
  return (
    <KImage
      ref={innerRef}
      image={canvas} x={0} y={0} listening={false}
      opacity={layer.opacity} globalCompositeOperation={gco(layer)}
    />
  );
}

export default function StudioEditor({ projectId, initialCanvas, artboardW: artboardWProp, artboardH: artboardHProp, templateKey, templateImage: templateImageProp, canvasKind, projectName, priceCents, printArea: printAreaProp, onClose, isDark }: Props) {
  const placements: any[] = ((initialCanvas as any)?.product?.placements) || [];
  const hasMulti = placements.length > 1;
  const [activeP, setActiveP] = useState(0);
  const ap = hasMulti ? placements[activeP] : null;
  const productPhoto: string | null = ((initialCanvas as any)?.product?.photo) || null;
  const [showPhoto, setShowPhoto] = useState(false);
  const artboardW = ap?.template_w || artboardWProp;
  const artboardH = ap?.template_h || artboardHProp;
  const templateImage = (showPhoto && productPhoto && (!hasMulti || activeP === 0))
    ? productPhoto
    : (ap?.background_url || ap?.image_url || templateImageProp);
  const printArea = ap?.print_area || printAreaProp;
  const placementLayers = useRef<Record<number, StudioLayer[]>>({});

  const garment = useHtmlImage(getProxyImageUrl(templateImage || null) || undefined);
  const [layers, setLayers] = useState<StudioLayer[]>(initialCanvas?.layers ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStyle, setAiStyle] = useState<"apparel" | "streetwear" | "vintage" | "lineart" | "embroidery" | "none">("apparel");
  const [regionMode, setRegionMode] = useState(false);
  const [region, setRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [fullScreenCanvas, setFullScreenCanvas] = useState(false);
  const [activePopover, setActivePopover] = useState<"none" | "actions" | "adjustments" | "layers" | "colors">("none");

  const [preview3d, setPreview3d] = useState<string | null>(null);
  const [edmOpen, setEdmOpen] = useState(false);
  
  type PrintDims = { placement: string; width_px: number; height_px: number; dpi: number; width_in: number; height_in: number };
  type ProductRef = { id?: number | string; mfr?: string; variant_id?: number | null; color?: string | null; print?: PrintDims | null };
  const [product, setProduct] = useState<ProductRef | undefined>((initialCanvas as any)?.product);

  const [matchOpen, setMatchOpen] = useState(false);
  const [matchType, setMatchType] = useState("t-shirt");
  const [matchBusy, setMatchBusy] = useState(false);
  const [matchResults, setMatchResults] = useState<any[]>([]);

  const runMatch = async () => {
    setMatchBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("printful-catalog", { body: { action: "match", garmentType: matchType } });
      const msg = await extractFnError(error, data);
      if (msg) { toast.error(msg); return; }
      setMatchResults(data.matches || []);
      if (!data.matches?.length) toast.error("No matching blanks found");
    } finally { setMatchBusy(false); }
  };

  const attachBlank = async (d: any) => {
    const color = d.colors?.[0] || null;
    const ref: ProductRef = { id: d.id, mfr: d.mfr, variant_id: color?.variant_id ?? null, color: color?.name ?? null };
    setProduct(ref);
    const costCents = d.min_cost_cents || 0;
    const retailCents = computeRetailCents(costCents);
    await (supabase as any).from("studio_projects").update({
      manufacturer: d.mfr,
      template_key: d.key,
      price_cents: retailCents,
      canvas: { layers: serializeLayers(), product: { ...ref, sizes: d.sizes, cost_cents: costCents } },
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    setMatchOpen(false);
    toast.success(`Matched to ${d.label} (${d.mfr}) · cost $${(costCents / 100).toFixed(2)} → retail $${(retailCents / 100).toFixed(2)}`);
  };

  const [mobileSheet, setMobileSheet] = useState<"none" | "layers" | "ai" | "export" | "add">("none");

  const [tool, setTool] = useState<"select" | "brush" | "eraser" | "fill">("select");
  const [brushSize, setBrushSize] = useState(120);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushOpacity, setBrushOpacity] = useState(1);     
  const [stabilizer, setStabilizer] = useState(0.45);      
  const [symmetry, setSymmetry] = useState<"off" | "v" | "h">("off");
  const [fillTolerance, setFillTolerance] = useState(48); 
  const [, setPaintVersion] = useState(0);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  
  type HistEntry = { kind: "layers"; layers: StudioLayer[] } | { kind: "paint"; id: string; data: string };
  const undoStack = useRef<HistEntry[]>([]);
  const redoStack = useRef<HistEntry[]>([]);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const paintCanvases = useRef<Record<string, HTMLCanvasElement>>({});
  const loadedPaint = useRef<Set<string>>(new Set());
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const painting = useRef(false);

  const [zoomPercent, setZoomPercent] = useState(100); 
  const [fitScale, setFitScale] = useState(0.15);
  const [workspaceSize, setWorkspaceSize] = useState({ w: 800, h: 600 });
  const scrollOuterRef = useRef<HTMLDivElement>(null);

  const scale = fitScale * (zoomPercent / 100);

  const move = (id: string, dir: number) => {
    commit((ls) => {
      const idx = ls.findIndex((l) => l.id === id);
      if (idx === -1) return ls;
      const n = ls.length;
      const target = idx + dir;
      if (target < 0 || target >= n) return ls;
      const copy = [...ls];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const getPaintCanvas = useCallback((l: StudioLayer): HTMLCanvasElement => {
    let c = paintCanvases.current[l.id];
    if (!c) {
      c = document.createElement("canvas");
      c.width = artboardW; c.height = artboardH;
      paintCanvases.current[l.id] = c;
    }
    if (l.src && !loadedPaint.current.has(l.id)) {
      loadedPaint.current.add(l.id);
      const im = new window.Image(); im.crossOrigin = "anonymous"; 
      im.src = l.src.includes("?") ? `${l.src}&cors=1` : `${l.src}?cors=1`;
      im.onload = () => { c!.getContext("2d")!.drawImage(im, 0, 0); redrawStage(); };
    }
    return c;
  }, [artboardW, artboardH]);

  const redrawStage = useCallback(() => {
    stageRef.current?.getLayers()?.[0]?.batchDraw();
    setPaintVersion((v) => v + 1);
  }, []);

  const recordLayers = useCallback((snapshot: StudioLayer[]) => {
    undoStack.current.push({ kind: "layers", layers: clone(snapshot) });
    if (undoStack.current.length > 80) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const commit = useCallback((updater: (ls: StudioLayer[]) => StudioLayer[]) => {
    setLayers((cur) => { recordLayers(cur); return updater(cur); });
  }, [recordLayers]);

  const restorePaint = (c: HTMLCanvasElement, dataUrl: string) => {
    const im = new window.Image(); im.src = dataUrl;
    im.onload = () => { const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0); redrawStage(); };
  };

  const handleUndo = useCallback(() => {
    const entry = undoStack.current.pop(); if (!entry) return;
    if (entry.kind === "layers") {
      setLayers((cur) => { redoStack.current.push({ kind: "layers", layers: clone(cur) }); return entry.layers; });
      setSelectedId(null);
    } else {
      const c = paintCanvases.current[entry.id]; if (!c) return;
      redoStack.current.push({ kind: "paint", id: entry.id, data: c.toDataURL() });
      restorePaint(c, entry.data);
    }
  }, [redrawStage]);

  const handleRedo = useCallback(() => {
    const entry = redoStack.current.pop(); if (!entry) return;
    if (entry.kind === "layers") {
      setLayers((cur) => { undoStack.current.push({ kind: "layers", layers: clone(cur) }); return entry.layers; });
      setSelectedId(null);
    } else {
      const c = paintCanvases.current[entry.id]; if (!c) return;
      undoStack.current.push({ kind: "paint", id: entry.id, data: c.toDataURL() });
      restorePaint(c, entry.data);
    }
  }, [redrawStage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) { e.preventDefault(); commit((ls) => ls.filter((l) => l.id !== selectedId)); setSelectedId(null); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo, commit, selectedId]);

  useEffect(() => {
    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.overflow-y-auto') || target.closest('.canvas-scroll-container')) {
        return;
      }
      e.preventDefault();
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.addEventListener("touchmove", preventTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
      document.removeEventListener("touchmove", preventTouchMove);
    };
  }, []);

  useEffect(() => {
    const originalBodyBg = document.body.style.backgroundColor;
    const originalHtmlBg = document.documentElement.style.backgroundColor;

    const targetColor = isDark ? "#000000" : "#ffffff";
    document.body.style.backgroundColor = targetColor;
    document.documentElement.style.backgroundColor = targetColor;

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    let originalThemeContent = "";
    if (themeMeta) {
      originalThemeContent = themeMeta.getAttribute("content") || "";
      themeMeta.setAttribute("content", targetColor);
    } else {
      themeMeta = document.createElement("meta");
      themeMeta.setAttribute("name", "theme-color");
      themeMeta.setAttribute("content", targetColor);
      document.head.appendChild(themeMeta);
    }

    return () => {
      document.body.style.backgroundColor = originalBodyBg;
      document.documentElement.style.backgroundColor = originalHtmlBg;
      if (themeMeta) {
        if (originalThemeContent) {
          themeMeta.setAttribute("content", originalThemeContent);
        } else {
          themeMeta.remove();
        }
      }
    };
  }, [isDark]);

  useEffect(() => {
    const fit = () => {
      const isMobile = window.innerWidth < 1024;
      const padW = (isMobile || fullScreenCanvas) ? 32 : 420;
      const padH = (isMobile || fullScreenCanvas) ? 140 : 220;
      const availW = Math.max(280, window.innerWidth - padW);
      const availH = Math.max(280, window.innerHeight - padH);
      
      setWorkspaceSize({ w: availW, h: availH });
      setFitScale(Math.min(availW / artboardW, availH / artboardH, 1));
    };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [artboardW, artboardH, fullScreenCanvas]);

  useEffect(() => {
    const outer = scrollOuterRef.current;
    if (!outer) return;

    const handle = requestAnimationFrame(() => {
      const viewW = outer.clientWidth;
      const viewH = outer.clientHeight;

      const stageW = artboardW * scale;
      const stageH = artboardH * scale;

      outer.scrollLeft = (stageW - viewW) / 2;
      outer.scrollTop = (stageH - viewH) / 2;
    });

    return () => cancelAnimationFrame(handle);
  }, [scale, artboardW, artboardH]);

  useEffect(() => {
    const tr = trRef.current; if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    tr.nodes(node && !regionMode && tool === "select" ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, layers, regionMode, tool]);

  const patchLayer = useCallback((id: string, patch: Partial<StudioLayer>) => {
    commit((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, [commit]);
  
  const livePatch = useCallback((id: string, patch: Partial<StudioLayer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const SNAP = 40;
  const snapDrag = useCallback((e: any) => {
    const n = e.target;
    const w = n.width() * n.scaleX(); const h = n.height() * n.scaleY();
    const cx = n.x() + w / 2; const cy = n.y() + h / 2;
    const v = Math.abs(cx - artboardW / 2) < SNAP;
    const hh = Math.abs(cy - artboardH / 2) < SNAP;
    if (v) n.x(artboardW / 2 - w / 2);
    if (hh) n.y(artboardH / 2 - h / 2);
    setGuides({ v, h: hh });
  }, [artboardW, artboardH]);

  const align = (axis: "h" | "v" | "both") => {
    if (!selectedId) return;
    const node = nodeRefs.current[selectedId];
    if (!node) return;
    const w = node.width() * node.scaleX(); const h = node.height() * node.scaleY();
    const patch: Partial<StudioLayer> = {};
    if (axis === "h" || axis === "both") patch.x = artboardW / 2 - w / 2;
    if (axis === "v" || axis === "both") patch.y = artboardH / 2 - h / 2;
    patchLayer(selectedId, patch);
  };

  const addText = () => {
    const l: StudioLayer = { id: uid(), type: "text", name: "Text", visible: true, x: artboardW / 2 - 400, y: artboardH / 2, rotation: 0, opacity: 1, text: "Your text", fontSize: 200, fill: brushColor, fontStyle: "bold", fontFamily: "Space Mono" };
    commit((ls) => [...ls, l]); setSelectedId(l.id);
  };

  const addImageAt = (src: string, name: string, box?: { x: number; y: number; w: number; h: number }, blend?: BlendMode) => {
    const place = (w: number, h: number, x: number, y: number) => {
      const l: StudioLayer = { id: uid(), type: "image", name, visible: true, x, y, rotation: 0, opacity: 1, src, width: w, height: h, blend };
      commit((ls) => [...ls, l]); setSelectedId(l.id);
    };
    if (box) { place(box.w, box.h, box.x, box.y); return; }
    const im = new window.Image(); im.crossOrigin = "anonymous";
    im.src = src.startsWith("data:") ? src : (src.includes("?") ? `${src}&cors=1` : `${src}?cors=1`);
    im.onload = () => {
      let iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      if (!iw || !ih) { iw = 1200; ih = 1200; }
      const ratio = iw / ih;
      const w = Math.min(artboardW * 0.7, iw);
      const h = w / ratio;
      place(w, h, (artboardW - w) / 2, (artboardH - h) / 2);
    };
    im.onerror = () => toast.error("Could not load that file — try a PNG, JPG, SVG or WEBP.");
  };

  const uploadImage = (file: File) => { const r = new FileReader(); r.onload = () => addImageAt(r.result as string, file.name); r.readAsDataURL(file); };

  const importTexture = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      const src = r.result as string;
      const im = new window.Image(); im.crossOrigin = "anonymous"; 
      im.src = src.includes("?") ? `${src}&cors=1` : `${src}?cors=1`;
      im.onload = () => {
        const s = document.createElement("canvas"); s.width = 16; s.height = 16;
        const sx = s.getContext("2d")!; sx.drawImage(im, 0, 0, 16, 16);
        const d = sx.getImageData(0, 0, 16, 16).data;
        let lum = 0; for (let i = 0; i < d.length; i += 4) lum += 0.299 * d[i] + 0.587 * d[i + 2] + 0.114 * d[i + 2];
        lum /= d.length / 4;
        addImageAt(src, file.name, undefined, lum > 128 ? "multiply" : "screen");
        toast.success(`Texture added (${lum > 128 ? "Multiply" : "Screen"}).`);
      };
    };
    r.readAsDataURL(file);
  };

  const addPaintLayer = () => {
    const l: StudioLayer = { id: uid(), type: "paint", name: "Paint", visible: true, x: 0, y: 0, rotation: 0, opacity: 1, blend: "source-over" };
    getPaintCanvas(l);
    commit((ls) => [...ls, l]); setSelectedId(l.id); setTool("brush");
  };

  const ensurePaintTarget = (create = false): string | null => {
    const sel = layers.find((l) => l.id === selectedId);
    if (sel?.type === "paint") return sel.id;
    const anyPaint = [...layers].reverse().find((l) => l.type === "paint");
    if (anyPaint) { setSelectedId(anyPaint.id); return anyPaint.id; }
    if (create) {
      const l: StudioLayer = { id: uid(), type: "paint", name: "Paint", visible: true, x: 0, y: 0, rotation: 0, opacity: 1, blend: "source-over" };
      getPaintCanvas(l);
      commit((ls) => [...ls, l]); setSelectedId(l.id);
      return l.id;
    }
    return null;
  };

  const snapshotPaint = (id: string) => {
    const c = paintCanvases.current[id]; if (!c) return;
    undoStack.current.push({ kind: "paint", id, data: c.toDataURL() });
    if (undoStack.current.length > 80) undoStack.current.shift();
    redoStack.current = [];
  };

  const dab = (id: string, x: number, y: number, pressure: number) => {
    const c = paintCanvases.current[id]; if (!c) return;
    const ctx = c.getContext("2d")!;
    const r = (brushSize / 2) * (0.4 + pressure * 0.6);
    ctx.save();
    
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = brushOpacity * (0.5 + pressure * 0.5);
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = Math.max(0, Math.min(1, brushOpacity * (0.5 + pressure * 0.5)));
    }

    const draw = (px: number, py: number) => {
      if (tool === "eraser") {
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      } else {
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, brushColor);
        g.addColorStop(0.75, brushColor);
        g.addColorStop(1, brushColor + "00");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      }
    };

    draw(x, y);
    if (symmetry === "v") draw(artboardW - x, y);
    if (symmetry === "h") draw(x, artboardH - y);
    ctx.restore();
  };

  const strokeTo = (id: string, x: number, y: number, pressure: number) => {
    const last = lastPt.current;
    let tx = x, ty = y;
    if (last && stabilizer > 0) {
      const k = 1 - stabilizer; 
      tx = last.x + (x - last.x) * k;
      ty = last.y + (y - last.y) * k;
    }
    if (last) {
      const dist = Math.hypot(tx - last.x, ty - last.y);
      const step = Math.max(2, brushSize * 0.18);
      const n = Math.ceil(dist / step);
      for (let i = 1; i <= n; i++) dab(id, last.x + ((tx - last.x) * i) / n, last.y + ((ty - last.y) * i) / n, pressure);
    } else dab(id, tx, ty, pressure);
    lastPt.current = { x: tx, y: ty };
    redrawStage();
  };

  const floodFill = (startX: number, startY: number) => {
    const destId = ensurePaintTarget(true);
    if (!destId) { toast.error("Could not create a paint layer to fill into"); return; }
    const dest = paintCanvases.current[destId]; if (!dest) return;
    const refLayer = layers.find((l) => l.reference && l.type === "paint" && paintCanvases.current[l.id]);
    const src = refLayer ? paintCanvases.current[refLayer.id] : dest;
    const W = dest.width, H = dest.height;
    const x = Math.round(startX), y = Math.round(startY);
    if (x < 0 || y < 0 || x >= W || y >= H) return;

    const sctx = src.getContext("2d", { willReadFrequently: true })!;
    const dctx = dest.getContext("2d")!;
    const sd = sctx.getImageData(0, 0, W, H);
    const dd = dctx.getImageData(0, 0, W, H);
    const sp = sd.data, dp = dd.data;
    const idx = (px: number, py: number) => (py * W + px) * 4;

    const si = idx(x, y);
    const tr = sp[si], tg = sp[si + 1], tb = sp[si + 2], ta = sp[si + 3];
    const fill = hexToRgb(brushColor);
    const tol = fillTolerance * fillTolerance * 3; 
    const match = (i: number) => {
      const dr = sp[i] - tr, dg = sp[i + 1] - tg, db = sp[i + 2] - tb, da = sp[i + 3] - ta;
      return dr * dr + dg * dg + db * db + da * da <= tol;
    };

    snapshotPaint(destId);
    const stack = [[x, y]];
    const seen = new Uint8Array(W * H);
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      const fi = cy * W + cx;
      if (seen[fi]) continue;
      seen[fi] = 1;
      const i = fi * 4;
      if (!match(i)) continue;
      dp[i] = fill.r; dp[i + 1] = fill.g; dp[i + 2] = fill.b; dp[i + 3] = 255;
      if (cx > 0) stack.push([cx - 1, cy]);
      if (cx < W - 1) stack.push([cx + 1, cy]);
      if (cy > 0) stack.push([cx, cy - 1]);
      if (cy < H - 1) stack.push([cx, cy + 1]);
    }
    dctx.putImageData(dd, 0, 0);
    redrawStage();
  };

  const runAi = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("ai-generate-image", { body });
    const msg = await extractFnError(error, data);
    if (msg) { toast.error(msg); return null; }
    return data.image_url as string;
  };

  const aiNewLayer = async () => {
    if (aiPrompt.trim().length < 3) { toast.error("Prompt too short"); return; }
    setAiBusy(true);
    try { const url = await runAi({ prompt: aiPrompt.trim(), width: 1024, height: 1024, persist: true, style: aiStyle }); if (url) { addImageAt(url, aiPrompt.slice(0, 24)); setAiPrompt(""); toast.success("AI layer added."); } }
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

  const finalizeRegion = async (r: { x: number; y: number; w: number; h: number }) => {
    if (r.w < 40 || r.h < 40) { setRegion(null); return; }
    if (aiPrompt.trim().length < 3) { toast.error("Type a prompt first, then draw the region"); setRegion(null); return; }
    setAiBusy(true);
    try {
      const longest = Math.max(r.w, r.h); const k = Math.min(1, 1024 / longest);
      const gw = Math.round(r.w * k); const gh = Math.round(r.h * k);
      const url = await runAi({ prompt: aiPrompt.trim(), width: gw, height: gh, persist: false, style: aiStyle });
      if (url) { addImageAt(url, aiPrompt.slice(0, 24), r); setAiPrompt(""); toast.success("Generated into region."); }
    } finally { setAiBusy(false); setRegion(null); setRegionMode(false); }
  };

  const serializeLayers = (): StudioLayer[] =>
    layers.map((l) => (l.type === "paint" && paintCanvases.current[l.id]) ? { ...l, src: paintCanvases.current[l.id].toDataURL() } : l);

  const switchPlacement = (idx: number) => {
    if (!hasMulti || idx === activeP) return;
    placementLayers.current[activeP] = serializeLayers();
    setSelectedId(null);
    undoStack.current = []; redoStack.current = [];
    const next = placementLayers.current[idx] ?? (placements[idx]?.layers as StudioLayer[]) ?? [];
    setActiveP(idx);
    setLayers(next);
  };

  const buildCanvasPayload = () => {
    const serialized = serializeLayers();
    const productNow = ((initialCanvas as any)?.product) || {};
    if (!hasMulti) return { layers: serialized, product: productNow };
    placementLayers.current[activeP] = serialized;
    const placementsPayload = placements.map((p, i) => ({
      ...p,
      layers: i === activeP ? serialized : (placementLayers.current[i] ?? p.layers ?? []),
    }));
    return { layers: serialized, product: { ...productNow, placements: placementsPayload } };
  };

  const captureStage = (targetWidth: number, hideChrome: boolean): string | undefined => {
    const stage = stageRef.current; if (!stage) return undefined;
    const sw = stage.width() || 1;
    const pixelRatio = Math.max(0.05, targetWidth / sw);
    const hidden: any[] = [];
    const hide = (sel: string) => stage.find(sel).forEach((n: any) => { if (n.visible()) { n.visible(false); hidden.push(n); } });
    hide(".symmetry-guide"); hide(".align-guide"); hide("Transformer");
    if (hideChrome) hide(".background-group");
    stage.getLayers()[0]?.batchDraw();
    let url: string | undefined;
    try { url = stage.toDataURL({ pixelRatio, mimeType: hideChrome ? "image/png" : "image/jpeg", quality: 0.9 }); }
    catch { url = undefined; }
    if (hidden.length) { hidden.forEach((n) => n.visible(true)); stage.getLayers()[0]?.batchDraw(); }
    return url;
  };

  const save = async () => {
    setSaving(true);
    try {
      const thumbnail = captureStage(720, false);
      const { error } = await supabase.from("studio_projects").update({ canvas: buildCanvasPayload(), thumbnail_url: thumbnail, updated_at: new Date().toISOString() }).eq("id", projectId);
      if (error) { toast.error(error.message); return; }
      toast.success("Saved.");
    } finally { setSaving(false); }
  };

  const [publishing, setPublishing] = useState(false);
  const publish = async () => {
    if (layers.length === 0) { toast.error("Design something first"); return; }
    setPublishing(true);
    setSelectedId(null);
    try {
      await new Promise((r) => setTimeout(r, 60));
      const dataUrl = captureStage(artboardW, true);
      if (!dataUrl) { toast.error("Could not render the design"); return; }
      const blob = await (await fetch(dataUrl)).blob();
      const path = `published/${projectId}-${Date.now()}.png`;
      const up = await supabase.storage.from("designs").upload(path, blob, { contentType: "image/png", upsert: true });
      if (up.error) { toast.error(`Upload failed: ${up.error.message}`); return; }
      const { data: pub } = supabase.storage.from("designs").getPublicUrl(path);

      const { data, error } = await supabase.functions.invoke("publish-design", {
        body: { projectId, imageUrl: pub.publicUrl, title: projectName, retailPriceCents: priceCents, templateKey },
      });
      const msg = await extractFnError(error, data);
      if (msg) { toast.error(msg); return; }
      toast.success("Published to Printful — sync details to publish on shop.");
    } finally {
      setPublishing(false);
    }
  };

  const exportPng = () => {
    const uri = captureStage(artboardW, true);
    if (!uri) {
      toast.error("Could not render the design");
      return;
    }
    const a = document.createElement("a");
    a.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}-design.png`;
    a.href = uri;
    a.click();
  };

  const open3d = () => {
    if (layers.length === 0) { toast.error("Design something first"); return; }
    setSelectedId(null);
    requestAnimationFrame(() => {
      const uri = captureStage(1024, true);
      if (!uri) { toast.error("Could not render the design"); return; }
      setPreview3d(uri);
    });
  };

  const fetchMockups = async (): Promise<string[]> => {
    if (product?.mfr !== "printful" || !product?.id || !product?.variant_id) {
      toast.error("Realistic mockups require a matched Printful product variant.");
      return [];
    }
    const dataUrl = captureStage(1800, true);
    if (!dataUrl) { toast.error("Could not render the design"); return []; }
    const blob = await (await fetch(dataUrl)).blob();
    const path = `mockup-src/${projectId}-${Date.now()}.png`;
    const up = await supabase.storage.from("designs").upload(path, blob, { contentType: "image/png", upsert: true });
    if (up.error) { toast.error(`Upload failed: ${up.error.message}`); return []; }
    const { data: pub } = supabase.storage.from("designs").getPublicUrl(path);
    const { data, error = null } = await supabase.functions.invoke("printful-catalog", {
      body: { action: "mockup", manufacturer: product.mfr, productId: product.id, variantId: product.variant_id, imageUrl: pub.publicUrl },
    });
    const msg = await extractFnError(error, data);
    if (msg) { toast.error(msg); return []; }
    return (data.mockups as string[]) || [];
  };

  const togglePopover = (type: "actions" | "adjustments" | "layers" | "colors") => {
    setActivePopover(prev => prev === type ? "none" : type);
  };

  const selected = layers.find((l) => l.id === selectedId);
  const pill = `flex items-center gap-1.5 text-[10px] font-medium px-3.5 py-2 rounded-full transition-all ${isDark ? "text-neutral-300 hover:bg-white/10" : "text-neutral-700 hover:bg-black/[0.06]"}`;
  const isHat = templateKey?.startsWith("hat");
  const isPoster = templateKey?.startsWith("poster");

  const defaultPa = isHat ? { x: 0.28, y: 0.32, w: 0.44, h: 0.36 } : isPoster ? { x: 0.06, y: 0.05, w: 0.88, h: 0.9 } : { x: 0.2, y: 0.14, w: 0.6, h: 0.62 };
  const pa = printArea || defaultPa;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col font-sans select-none overflow-hidden ${isDark ? "bg-[#121212] text-neutral-100" : "bg-neutral-50 text-neutral-900"}`}>
      
      {/* ─────────────────────────────────────────────────────────────
         THE ICONIC PROCREATE-STYLE TOP NAVIGATION BAR
         ───────────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-6 py-2 border-b shrink-0 z-50 ${isDark ? "bg-[#1c1c1e] border-neutral-800" : "bg-white border-neutral-200 shadow-sm"}`}>
        
        {/* Left Section: Gallery (Close) & Utility Modifiers */}
        <div className="flex items-center gap-1">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg text-sm font-semibold tracking-wide text-indigo-500 hover:bg-indigo-500/10 transition-colors"
          >
            Gallery
          </button>
          
          <span className="w-px h-5 bg-neutral-300 dark:bg-neutral-700 mx-2" />

          {/* Actions (Wrench Popover) */}
          <button 
            onClick={() => togglePopover("actions")} 
            className={`p-2.5 rounded-lg transition-colors ${activePopover === "actions" ? "text-indigo-500 bg-indigo-500/10" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            title="Actions (Wrench)"
          >
            <Wrench size={18} />
          </button>

          {/* Adjustments (Magic Wand Popover) */}
          <button 
            onClick={() => togglePopover("adjustments")} 
            className={`p-2.5 rounded-lg transition-colors ${activePopover === "adjustments" ? "text-indigo-500 bg-indigo-500/10" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            title="Adjustments (Filters & AI)"
          >
            <Wand2 size={18} />
          </button>

          {/* Selection (Marquee / Region Tool) */}
          <button 
            onClick={() => { setRegionMode(v => !v); setTool("select"); setSelectedId(null); }} 
            className={`p-2.5 rounded-lg transition-colors ${regionMode ? "text-indigo-500 bg-indigo-500/10" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            title="Selection (Region AI)"
          >
            <SquareDashed size={18} />
          </button>

          {/* Transform / Selection Arrow */}
          <button 
            onClick={() => { setTool("select"); setRegionMode(false); }} 
            className={`p-2.5 rounded-lg transition-colors ${tool === "select" && !regionMode ? "text-indigo-500 bg-indigo-500/10" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            title="Transform (Select / Move)"
          >
            <MousePointer2 size={18} />
          </button>
        </div>

        {/* Project Context Label */}
        <span className="hidden md:inline text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500 max-w-[200px] truncate">
          {projectName}
        </span>

        {/* Right Section: Artistic Painting Tools, Layers & Colors */}
        <div className="flex items-center gap-1">
          {/* Paint Brush */}
          <button 
            onClick={() => { setTool("brush"); setRegionMode(false); }} 
            className={`p-2.5 rounded-lg transition-colors ${tool === "brush" ? "text-indigo-500 bg-indigo-500/10" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            title="Paint Tool"
          >
            <Paintbrush size={18} />
          </button>

          {/* Eraser Tool */}
          <button 
            onClick={() => { setTool("eraser"); setRegionMode(false); }} 
            className={`p-2.5 rounded-lg transition-colors ${tool === "eraser" ? "text-indigo-500 bg-indigo-500/10" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            title="Eraser Tool"
          >
            <Eraser size={18} />
          </button>

          {/* Paint Bucket Fill */}
          <button 
            onClick={() => { setTool("fill"); setRegionMode(false); }} 
            className={`p-2.5 rounded-lg transition-colors ${tool === "fill" ? "text-indigo-500 bg-indigo-500/10" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            title="Flood Fill"
          >
            <PaintBucket size={18} />
          </button>

          {/* Layers Popover Toggle */}
          <button 
            onClick={() => togglePopover("layers")} 
            className={`p-2.5 rounded-lg transition-colors relative ${activePopover === "layers" ? "text-indigo-500 bg-indigo-500/10" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
            title="Layers Menu"
          >
            <Layers size={18} />
            {layers.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-indigo-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">
                {layers.length}
              </span>
            )}
          </button>

          {/* Color Palette Disk */}
          <button 
            onClick={() => togglePopover("colors")} 
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center justify-center relative"
            title="Color Ring"
          >
            <div 
              className="w-6 h-6 rounded-full border border-neutral-300 dark:border-neutral-700 shadow-inner"
              style={{ backgroundColor: brushColor }}
            />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         THE ICONIC FLOATING DOUBLE BAR (Size / Opacity Vertical Sidebar)
         ───────────────────────────────────────────────────────────── */}
      <div className="absolute left-6 top-[15%] md:top-[25%] bottom-[15%] flex flex-col items-center justify-between py-6 w-14 z-40 select-none pointer-events-none">
        
        {/* Brush Size vertical slider wrapper */}
        <div className="flex flex-col items-center gap-1.5 group pointer-events-auto">
          <span className="text-[8px] font-bold opacity-45 uppercase tracking-wider text-neutral-500">Size</span>
          <div className="h-32 w-4 md:w-5 bg-neutral-200/60 dark:bg-neutral-900/60 backdrop-blur-md rounded-full relative flex items-center justify-center overflow-hidden border border-neutral-300/10 shadow-lg cursor-ns-resize">
            <input
              type="range"
              min={1}
              max={600}
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="absolute inset-0 h-full w-full opacity-0 cursor-ns-resize rotate-180"
              style={{ writingMode: "bt-lr", WebkitAppearance: "slider-vertical" } as any}
            />
            {/* Liquid vertical fill indicator */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-indigo-500 pointer-events-none transition-all duration-75"
              style={{ height: `${(brushSize / 600) * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tabular-nums">{brushSize}px</span>
        </div>

        {/* Centered Undo & Redo circles directly within the HUD */}
        <div className="flex flex-col gap-3 pointer-events-auto">
          <button 
            onClick={handleUndo} 
            className="w-9 h-9 rounded-full bg-neutral-200/75 dark:bg-neutral-900/75 hover:bg-neutral-300 dark:hover:bg-neutral-800 backdrop-blur-md border border-neutral-300/10 shadow-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 active:scale-90 transition-all"
            title="Undo"
          >
            <Undo2 size={14} />
          </button>
          <button 
            onClick={handleRedo} 
            className="w-9 h-9 rounded-full bg-neutral-200/75 dark:bg-neutral-900/75 hover:bg-neutral-300 dark:hover:bg-neutral-800 backdrop-blur-md border border-neutral-300/10 shadow-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 active:scale-90 transition-all"
            title="Redo"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Brush Opacity vertical slider wrapper */}
        <div className="flex flex-col items-center gap-1.5 group pointer-events-auto">
          <span className="text-[8px] font-bold opacity-45 uppercase tracking-wider text-neutral-500">Opac</span>
          <div className="h-32 w-4 md:w-5 bg-neutral-200/60 dark:bg-neutral-900/60 backdrop-blur-md rounded-full relative flex items-center justify-center overflow-hidden border border-neutral-300/10 shadow-lg cursor-ns-resize">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(brushOpacity * 100)}
              onChange={(e) => setBrushOpacity(parseInt(e.target.value) / 100)}
              className="absolute inset-0 h-full w-full opacity-0 cursor-ns-resize rotate-180"
              style={{ writingMode: "bt-lr", WebkitAppearance: "slider-vertical" } as any}
            />
            {/* Opacity Liquid vertical fill indicator */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-indigo-500 pointer-events-none transition-all duration-75"
              style={{ height: `${brushOpacity * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tabular-nums">{Math.round(brushOpacity * 100)}%</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         INTERACTIVE OVERLAYS (Wrench / Wand / Layers / Colors)
         ───────────────────────────────────────────────────────────── */}
      {activePopover !== "none" && (
        <div className="absolute inset-0 z-40 bg-transparent" onClick={() => setActivePopover("none")}>
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-16 rounded-[22px] border p-5 max-w-[340px] w-full shadow-2xl transition-all duration-150 animate-fade-in ${
              activePopover === "colors" || activePopover === "layers" ? "right-6" : "left-6"
            } ${isDark ? "bg-[#1c1c1e] border-neutral-800 text-neutral-100" : "bg-white border-neutral-200 text-neutral-900"}`}
          >
            {/* popover header decoration */}
            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-800 rounded-full mx-auto mb-4" />

            {/* popover templates */}
            {activePopover === "actions" && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500">Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={addText} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-dashed text-neutral-500 hover:text-indigo-500 transition-colors">
                    <Type size={16} /> <span className="text-[9px] uppercase font-bold tracking-wider">Text</span>
                  </button>
                  <label className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-dashed text-neutral-500 hover:text-indigo-500 transition-colors cursor-pointer">
                    <ImagePlus size={16} /> <span className="text-[9px] uppercase font-bold tracking-wider">Upload</span>
                    <input type="file" accept="image/*,.svg,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { uploadImage(e.target.files[0]); setActivePopover("none"); } }} />
                  </label>
                </div>
                
                <span className="block h-px bg-neutral-200 dark:bg-neutral-800" />
                
                <div className="space-y-1">
                  <button onClick={open3d} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <span className="flex items-center gap-2"><Box size={14} /> 3D Garment View</span>
                    <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full uppercase">3D</span>
                  </button>
                  {product?.mfr === "printful" && (
                    <button onClick={() => setEdmOpen(true)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      <span className="flex items-center gap-2"><Wand2 size={14} /> Printful Design Maker</span>
                    </button>
                  )}
                  {!product?.id && (
                    <button onClick={() => setMatchOpen(true)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      <span className="flex items-center gap-2"><Shirt size={14} /> Match Blanks</span>
                    </button>
                  )}
                </div>

                <span className="block h-px bg-neutral-200 dark:bg-neutral-800" />
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase opacity-50">Symmetry mirror</span>
                    <button onClick={() => setSymmetry((s) => (s === "off" ? "v" : s === "v" ? "h" : "off"))} className="text-[10px] font-bold text-indigo-400 hover:underline uppercase">
                      {symmetry === "off" ? "Disabled" : symmetry === "v" ? "Vertical" : "Horizontal"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase opacity-50">Symmetry stabilizer</span>
                    <input type="range" min={0} max={90} value={Math.round(stabilizer * 100)} onChange={(e) => setStabilizer(parseInt(e.target.value) / 100)} className="w-24 accent-indigo-500" />
                  </div>
                </div>

                <span className="block h-px bg-neutral-200 dark:bg-neutral-800" />

                <div className="flex items-center gap-1">
                  <button onClick={exportPng} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[10px] font-bold uppercase border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <Download size={12} /> Export
                  </button>
                  <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[10px] font-bold uppercase border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                  </button>
                </div>
                <button onClick={publish} disabled={publishing} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-full text-[10px] font-bold uppercase bg-indigo-500 text-white hover:bg-indigo-600">
                  {publishing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Publish Design
                </button>
              </div>
            )}

            {activePopover === "adjustments" && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500">Adjustments</p>
                {selected ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold">{selected.name} Filters</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold opacity-60">
                        <span>Gaussian blur</span>
                        <span>{selected.blur || 0}%</span>
                      </div>
                      <input 
                        type="range" min={0} max={100} value={selected.blur || 0}
                        onMouseDown={() => recordLayers(layers)}
                        onChange={(e) => livePatch(selected.id, { blur: parseInt(e.target.value) })}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] opacity-50 py-2">Select an image/text layer to adjust filters.</p>
                )}

                <span className="block h-px bg-neutral-200 dark:bg-neutral-800" />
                
                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide">AI Generation</p>
                  <textarea 
                    value={aiPrompt} 
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe print layers to generate..."
                    className="w-full h-16 bg-neutral-100 dark:bg-neutral-900 border-0 rounded-xl p-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100" 
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    {(["apparel", "streetwear", "vintage", "lineart", "embroidery"] as const).map((s) => (
                      <button key={s} onClick={() => setAiStyle(s)} className={`text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider ${aiStyle === s ? "bg-indigo-500 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={aiNewLayer} disabled={aiBusy} className="flex-1 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500 text-white hover:bg-indigo-600 flex items-center justify-center gap-1">
                      {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate Layer
                    </button>
                    {selected?.type === "image" && (
                      <button onClick={aiRegenerateSelected} disabled={aiBusy} className="py-2.5 px-4 rounded-full text-[10px] font-bold uppercase border hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        Reimagine
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activePopover === "layers" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500">Layers</p>
                  <button onClick={addPaintLayer} className="text-xs font-bold text-indigo-500 hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add Paint
                  </button>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {[...layers].reverse().map((l) => (
                    <div 
                      key={l.id} 
                      onClick={() => setSelectedId(l.id)}
                      className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        selectedId === l.id 
                          ? (isDark ? "bg-white/10 border-neutral-700" : "bg-indigo-50 border-indigo-100") 
                          : "border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { visible: !l.visible }); }} className="text-neutral-400">
                          {l.visible ? <Eye size={14} /> : <EyeOff size={14} className="opacity-40" />}
                        </button>
                        <span className="flex-1 text-[11px] font-medium truncate flex items-center gap-1">
                          {l.clip && <span className="text-indigo-500">↳</span>}
                          {l.type === "text" ? (l.text || "Text") : l.name}
                        </span>
                        <div className="flex items-center gap-1 opacity-70">
                          <button onClick={(e) => { e.stopPropagation(); move(l.id, 1); }} className="p-0.5"><ArrowUp size={11} /></button>
                          <button onClick={(e) => { e.stopPropagation(); move(l.id, -1); }} className="p-0.5"><ArrowDown size={11} /></button>
                          <button onClick={(e) => { e.stopPropagation(); commit((ls) => ls.filter((x) => x.id !== l.id)); if (selectedId === l.id) setSelectedId(null); }} className="p-0.5 text-rose-500"><Trash2 size={11} /></button>
                        </div>
                      </div>

                      {/* Inside layer advanced parameter modifier panel */}
                      {selectedId === l.id && (
                        <div className="mt-2.5 pt-2.5 border-t border-neutral-200 dark:border-neutral-800 space-y-2 text-[10px] text-neutral-500">
                          <div className="flex items-center justify-between gap-1">
                            <span>Blend Mode:</span>
                            <select value={l.blend || "source-over"} onChange={(e) => patchLayer(l.id, { blend: e.target.value as BlendMode })} className="bg-transparent border-0 font-semibold focus:ring-0">
                              {BLENDS.map((b) => <option key={b} value={b} className="text-black">{BLEND_LABEL[b]}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <input type="checkbox" checked={!!l.clip} onChange={(e) => patchLayer(l.id, { clip: e.target.checked })} />
                              Clip to layer below
                            </span>
                            {l.type === "paint" && (
                              <span className="flex items-center gap-1">
                                <input type="checkbox" checked={!!l.reference} onChange={(e) => commit((ls) => ls.map((x) => x.type === "paint" ? { ...x, reference: x.id === l.id ? e.target.checked : false } : x))} />
                                Reference
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePopover === "colors" && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500">Color Swatches</p>
                <div className="grid grid-cols-6 gap-2">
                  {["#000000", "#ffffff", "#e02424", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#6b7280"].map((c) => (
                    <button 
                      key={c} 
                      onClick={() => setBrushColor(c)} 
                      className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 shadow transition-transform active:scale-90"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase">Custom color</span>
                  <input 
                    type="color" 
                    value={brushColor} 
                    onChange={(e) => setBrushColor(e.target.value)} 
                    className="w-10 h-7 rounded bg-transparent border-0 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         MAIN INFINITE-STYLE DIGITAL CANVAS VIEWPORT
         ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        <div 
          ref={scrollOuterRef} 
          className="flex-1 overflow-auto p-4 min-h-[380px] canvas-scroll-container bg-[radial-gradient(ellipse_at_center,#2c2c2e_0%,#1c1c1e_60%,#121212_100%)] select-none"
        >
          {/* Sizing wrapper to support true dynamic zoom/panning */}
          <div 
            className="relative block"
            style={{
              width: `${Math.max(workspaceSize.w, artboardW * scale)}px`,
              height: `${Math.max(workspaceSize.h, artboardH * scale)}px`,
            }}
          >
            <div 
              className="absolute rounded-[24px] overflow-hidden shadow-2xl transition-all duration-75 border border-neutral-800 bg-[#ffffff]"
              style={{
                left: `${Math.max(0, (workspaceSize.w - artboardW * scale) / 2)}px`,
                top: `${Math.max(0, (workspaceSize.h - artboardH * scale) / 2)}px`,
                width: `${artboardW * scale}px`,
                height: `${artboardH * scale}px`,
              }}
            >
              <Stage
                ref={stageRef}
                width={artboardW * scale} height={artboardH * scale} scaleX={scale} scaleY={scale}
                style={{ cursor: tool === "brush" ? "crosshair" : tool === "eraser" ? "cell" : "default" }}
                onMouseDown={(e) => {
                  if (tool === "fill") {
                    const p = e.target.getStage()!.getRelativePointerPosition()!;
                    floodFill(p.x, p.y);
                    return;
                  }
                  if (tool === "brush" || tool === "eraser") {
                    const id = ensurePaintTarget(true);
                    if (!id) { toast.error("Could not create a paint layer"); return; }
                    const p = e.target.getStage()!.getRelativePointerPosition()!;
                    snapshotPaint(id); painting.current = true; lastPt.current = null;
                    strokeTo(id, p.x, p.y, (e.evt as any).pressure || 0.5);
                    return;
                  }
                  if (regionMode) { const p = e.target.getStage()!.getRelativePointerPosition()!; drawing.current = { x: p.x, y: p.y }; setRegion({ x: p.x, y: p.y, w: 0, h: 0 }); return; }
                  if (e.target === e.target.getStage() || (e.target as any).attrs?.name === "bg") setSelectedId(null);
                }}
                onMouseMove={(e) => {
                  if ((tool === "brush" || tool === "eraser") && painting.current) {
                    const id = layers.find((l) => l.id === selectedId)?.type === "paint" ? selectedId! : ensurePaintTarget();
                    if (id) { const p = e.target.getStage()!.getRelativePointerPosition()!; strokeTo(id, p.x, p.y, (e.evt as any).pressure || 0.5); }
                    return;
                  }
                  if (regionMode && drawing.current) { const p = e.target.getStage()!.getRelativePointerPosition()!; const s = drawing.current; setRegion({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); }
                }}
                onMouseUp={() => {
                  if (painting.current) { painting.current = false; lastPt.current = null; return; }
                  if (regionMode && drawing.current && region) { drawing.current = null; finalizeRegion(region); }
                }}
                onTouchStart={(e) => {
                  if (tool === "brush" || tool === "eraser") {
                    const id = ensurePaintTarget(true);
                    if (!id) return;
                    const p = e.target.getStage()!.getRelativePointerPosition()!;
                    snapshotPaint(id); painting.current = true; lastPt.current = null;
                    strokeTo(id, p.x, p.y, 0.5);
                  }
                }}
                onTouchMove={(e) => {
                  if ((tool === "brush" || tool === "eraser") && painting.current) {
                    const id = layers.find((l) => l.id === selectedId)?.type === "paint" ? selectedId! : ensurePaintTarget();
                    if (id) { const p = e.target.getStage()!.getRelativePointerPosition()!; strokeTo(id, p.x, p.y, 0.5); }
                  }
                }}
                onTouchEnd={() => {
                  if (painting.current) { painting.current = false; lastPt.current = null; }
                }}
              >
                <Layer>
                  <Group name="background-group">
                    <Rect name="bg" x={0} y={0} width={artboardW} height={artboardH} fill="#ffffff" listening />
                    {canvasKind === "canvas" ? null : garment ? (
                      <>
                        <KImage name="garment" image={garment} x={0} y={0} width={artboardW} height={artboardH} listening={false} />
                        <Rect name="guide" x={artboardW * pa.x} y={artboardH * pa.y} width={artboardW * pa.w} height={artboardH * pa.h} stroke="#6366f1" strokeWidth={4} dash={[26, 18]} cornerRadius={20} listening={false} opacity={0.6} />
                      </>
                    ) : (
                      <>
                        <Rect name="garment" x={artboardW * 0.06} y={artboardH * 0.05} width={artboardW * 0.88} height={artboardH * 0.9} cornerRadius={artboardW * 0.06} fill={isDark ? "#161616" : "#f1f1f3"} listening={false} />
                        <Rect name="guide" x={artboardW * pa.x} y={artboardH * pa.y} width={artboardW * pa.w} height={artboardH * pa.h} stroke="#9ca3af" strokeWidth={4} dash={[26, 18]} cornerRadius={20} listening={false} />
                      </>
                    )}
                  </Group>

                  {layers.map((l) => l.type === "paint" ? (
                    <PaintNode key={l.id} layer={l} canvas={getPaintCanvas(l)} />
                  ) : l.type === "image" ? (
                    <ImageNode key={l.id} layer={l} listening={!regionMode && tool === "select"}
                      nodeRef={(n: any) => (nodeRefs.current[l.id] = n)} onDragMove={snapDrag}
                      onSelect={() => setSelectedId(l.id)} onChange={(patch: any) => { patchLayer(l.id, patch); setGuides({ v: false, h: false }); }} />
                  ) : (
                    <TextNode key={l.id} layer={l} listening={!regionMode && tool === "select"}
                      nodeRef={(n: any) => (nodeRefs.current[l.id] = n)} onDragMove={snapDrag}
                      onSelect={() => setSelectedId(l.id)} onChange={(patch: any) => { patchLayer(l.id, patch); setGuides({ v: false, h: false }); }} />
                  ))}

                  {(tool === "brush" || tool === "eraser") && symmetry === "v" && <Rect name="symmetry-guide" x={artboardW / 2 - 1} y={0} width={2} height={artboardH} fill="#6366f1" opacity={0.5} listening={false} />}
                  {(tool === "brush" || tool === "eraser") && symmetry === "h" && <Rect name="symmetry-guide" x={0} y={artboardH / 2 - 1} width={artboardW} height={2} fill="#6366f1" opacity={0.5} listening={false} />}

                  {guides.v && <Rect name="align-guide" x={artboardW / 2 - 1} y={0} width={2} height={artboardH} fill="#22d3ee" listening={false} />}
                  {guides.h && <Rect name="align-guide" x={0} y={artboardH / 2 - 1} width={artboardW} height={2} fill="#22d3ee" listening={false} />}

                  {region && <Rect x={region.x} y={region.y} width={region.w} height={region.h} stroke="#6366f1" strokeWidth={4} dash={[16, 12]} fill="rgba(99,102,241,0.08)" listening={false} />}
                  <Transformer
                    ref={trRef} rotateEnabled keepRatio
                    enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]}
                    anchorCornerRadius={20} borderStroke="#6366f1" anchorStroke="#6366f1" anchorSize={14}
                    boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
                  />
                </Layer>
              </Stage>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         INTEGRATED WORKSPACE FLOATING ZOOM BAR (Touch Panning Controller)
         ───────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md shadow-xl border border-neutral-200/20 pointer-events-auto">
        <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 select-none">Zoom</span>
        <input 
          type="range" min={100} max={800} step={10} value={zoomPercent} 
          onChange={(e) => setZoomPercent(parseInt(e.target.value))} 
          className="w-32 sm:w-44 accent-indigo-500 cursor-pointer"
        />
        <span className="text-[10px] font-bold text-neutral-500 select-none w-8">{zoomPercent}%</span>
        
        <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-800" />

        {/* Dynamic Photo/Template surface view switcher */}
        {(hasMulti || productPhoto) && (
          <div className="flex items-center gap-1.5">
            {productPhoto && (!hasMulti || activeP === 0) && (
              <button 
                onClick={() => setShowPhoto(!showPhoto)}
                className={`text-[9px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full ${showPhoto ? "bg-indigo-500 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"}`}
              >
                {showPhoto ? "Photo Mode" : "Template View"}
              </button>
            )}
            {hasMulti && placements.map((p, i) => (
              <button 
                key={p.placement + i} 
                onClick={() => switchPlacement(i)}
                className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${activeP === i ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "text-neutral-500"}`}
              >
                {String(p.placement || `P${i+1}`).substring(0, 5)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
         MODALS & SYSTEM DIALOGS (Attach Blanks / 3D / Printful Maker)
         ───────────────────────────────────────────────────────────── */}
      {matchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setMatchOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-[24px] border p-6 ${isDark ? "bg-[#1c1c1e] border-neutral-800 text-neutral-100" : "bg-white border-neutral-200 text-neutral-900"}`}>
            <h2 className="text-[13px] font-semibold mb-1">Match to a real blank</h2>
            <p className="text-[10px] mb-4 text-neutral-500">Pick a garment category to fetch and match cheapest alternatives.</p>
            <div className="flex items-center gap-2 mb-4">
              <select value={matchType} onChange={(e) => setMatchType(e.target.value)}
                className={`flex-1 text-[11px] rounded-full px-3 py-2 border focus:outline-none ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"}`}>
                {["t-shirt", "hoodie", "sweatshirt", "tank", "long sleeve", "hat"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={runMatch} disabled={matchBusy}
                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase rounded-full bg-indigo-500 text-white hover:bg-indigo-600">
                {matchBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Find
              </button>
            </div>
            <div className="max-h-[44vh] overflow-y-auto flex flex-col gap-2">
              {matchResults.map((d, i) => (
                <button key={`${d.mfr}-${d.id}`} onClick={() => attachBlank(d)}
                  className={`flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-all ${isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-50"}`}>
                  <div className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center ${isDark ? "bg-neutral-900" : "bg-neutral-100"}`}>
                    {d.image ? <img src={getProxyImageUrl(d.image)} alt="" className="w-full h-full object-contain" /> : <Shirt size={16} className="opacity-30" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium truncate">{d.label}</p>
                    <p className="text-[9px] uppercase tracking-wider text-neutral-500">{d.mfr} · {d.colors?.length || 0} colors</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-semibold">${((d.min_cost_cents || 0) / 100).toFixed(2)}</p>
                    {i === 0 && <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 uppercase tracking-widest font-bold">Cheapest</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {preview3d && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 text-white"><Loader2 className="animate-spin animate-infinite" /></div>}>
          <Garment3DPreview design={preview3d} isDark={isDark} onClose={() => setPreview3d(null)}
            canMockup={product?.mfr === "printful" && !!product?.variant_id}
            printWidthIn={product?.print?.width_in ?? null}
            printHeightIn={product?.print?.height_in ?? null}
            fetchMockups={fetchMockups} />
        </Suspense>
      )}

      {edmOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 text-white"><Loader2 className="animate-spin animate-infinite" /></div>}>
          <PrintfulDesignMaker
            productId={product?.id}
            onDesign={(url, name) => addImageAt(url, name)}
            onClose={() => setEdmOpen(false)} />
        </Suspense>
      )}

    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}

async function extractFnError(error: any, data: any): Promise<string | null> {
  if (data?.error) return data.error;
  if (!error) return null;
  const ctx = error.context;
  if (ctx?.json) { try { const b = await ctx.json(); if (b?.error) return b.error; } catch {} }
  return error.message || "Request failed";
}

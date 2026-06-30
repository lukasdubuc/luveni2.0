// ─────────────────────────────────────────────────────────────
//  Luveni GM — StudioEditor
//  Free, Konva-powered design editor. Layers, text, images,
//  transform, undo/redo, AI new-layer, and region-select AI
//  (marquee a space → generate into it). Client-only (Konva needs DOM).
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { Stage, Layer, Image as KImage, Text as KText, Rect, Transformer, Group } from "react-konva";
import Konva from "konva";
import {
  Type, ImagePlus, Sparkles, Trash2, Eye, EyeOff, ArrowUp, ArrowDown,
  Save, Download, Loader2, Wand2, X, RefreshCw, Undo2, Redo2, SquareDashed,
  Paintbrush, FlipHorizontal2, FlipVertical2, MousePointer2, PaintBucket,
  AlignCenterHorizontal, AlignCenterVertical, AlignVerticalJustifyCenter, Layers, Plus,
  Maximize2, Minimize2, Box, Shirt
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeRetailCents } from "@/lib/pricing";

// Three.js 3D garment preview — DOM-only, loaded lazily so SSR never touches it.
const Garment3DPreview = lazy(() => import("./Garment3DPreview"));
// Printful Embedded Design Maker — loaded lazily (pulls in Printful's embed.js).
const PrintfulDesignMaker = lazy(() => import("./PrintfulDesignMaker"));

export type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten";

export type StudioLayer = {
  id: string; type: "image" | "text" | "paint"; name: string; visible: boolean;
  x: number; y: number; rotation: number; opacity: number;
  src?: string; width?: number; height?: number;
  text?: string; fontSize?: number; fill?: string; fontStyle?: string; fontFamily?: string;
  blend?: BlendMode;
  clip?: boolean;   // clip to the layers below (Procreate clipping mask)
  blur?: number;    // 0–100 gaussian blur
  reference?: boolean; // boundary source for the flood-fill bucket
};

// Utility function to transparently rewrite Printful and Apliiq image CDN URLs 
// to go through our Supabase Edge Function proxy, avoiding canvas/WebGL CORS blocks.
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

// Non-destructive Konva blur via node caching. Re-caches when radius or the
// content dependency changes; clears cache at radius 0.
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
    // Directly append a cache-busting query parameter to force fresh CORS headers
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

// Paint layers render a backing HTMLCanvas as a Konva image. The canvas is
// painted imperatively (brush strokes); `version` forces a re-render when the
// blend/opacity changes (live strokes call layer.batchDraw directly).
function PaintNode({ layer, canvas }: any) {
  const innerRef = useRef<Konva.Image>(null);
  // Recache only when blur changes (not on every stroke) to keep painting fast.
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
  // Multi-placement: a product can have several real print locations (front,
  // back, sleeves…), each with its own template surface, print box and layers.
  // For single/no-placement projects this is inert and behaves exactly as before.
  const placements: any[] = ((initialCanvas as any)?.product?.placements) || [];
  const hasMulti = placements.length > 1;
  const [activeP, setActiveP] = useState(0);
  const ap = hasMulti ? placements[activeP] : null;
  const artboardW = ap?.template_w || artboardWProp;
  const artboardH = ap?.template_h || artboardHProp;
  const templateImage = ap?.image_url || templateImageProp;
  const printArea = ap?.print_area || printAreaProp;
  // Per-placement layer sets, swapped when the active placement changes.
  const placementLayers = useRef<Record<number, StudioLayer[]>>({});

  // Proxy the product/template image so it loads CORS-clean into Konva (raw
  // Printful/Apliiq CDN URLs don't send Access-Control headers, which would
  // leave the garment template blank).
  const garment = useHtmlImage(getProxyImageUrl(templateImage || null) || undefined);
  const [layers, setLayers] = useState<StudioLayer[]>(initialCanvas?.layers ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  // Apparel-tuned generation preset (mirrors edge-function APPAREL_STYLES).
  const [aiStyle, setAiStyle] = useState<"apparel" | "streetwear" | "vintage" | "lineart" | "embroidery" | "none">("apparel");
  const [regionMode, setRegionMode] = useState(false);
  const [region, setRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Tablet/Desktop clean mode: collapses panels to give maximum drawing space
  const [fullScreenCanvas, setFullScreenCanvas] = useState(false);

  // 3D garment preview (CLO-3D-style live view). Holds the flattened
  // transparent design PNG; null when the modal is closed.
  const [preview3d, setPreview3d] = useState<string | null>(null);
  // Printful Embedded Design Maker modal (hybrid: alongside our own AI/paint).
  const [edmOpen, setEdmOpen] = useState(false);
  // Manufacturer product the project was created from (id/variant/color),
  // used to render photoreal on-model mockups of the exact print. Stateful so
  // a traced/custom canvas can be matched & attached to a real blank.
  type PrintDims = { placement: string; width_px: number; height_px: number; dpi: number; width_in: number; height_in: number };
  type ProductRef = { id?: number | string; mfr?: string; variant_id?: number | null; color?: string | null; print?: PrintDims | null };
  const [product, setProduct] = useState<ProductRef | undefined>((initialCanvas as any)?.product);

  // Blank-matching (for traced/custom canvases): find the closest real blank
  // on the cheaper manufacturer so 3D mockups & publish reflect a real product.
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
    // Persist onto the project so it survives reload & feeds publish/pricing.
    // Cast: studio_projects isn't in the generated Supabase types yet.
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

  // Mobile Sheets manager: "none" | "layers" | "ai" | "export" | "add"
  const [mobileSheet, setMobileSheet] = useState<"none" | "layers" | "ai" | "export" | "add">("none");

  // Paint engine state
  const [tool, setTool] = useState<"select" | "brush" | "fill">("select");
  const [brushSize, setBrushSize] = useState(120);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushOpacity, setBrushOpacity] = useState(1);     // 0–1, applied per stroke
  const [stabilizer, setStabilizer] = useState(0.45);      // 0–0.9 stroke smoothing (Procreate-style)
  const [symmetry, setSymmetry] = useState<"off" | "v" | "h">("off");
  const [fillTolerance, setFillTolerance] = useState(48); // bucket color match tolerance (0–128)
  const [, setPaintVersion] = useState(0);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  // Unified, chronological history so undo/redo follows the real order of
  // actions (a layer edit then a brush stroke undoes the stroke first, etc.) —
  // not two separate stacks that clump paint and layer ops out of order.
  type HistEntry = { kind: "layers"; layers: StudioLayer[] } | { kind: "paint"; id: string; data: string };
  const undoStack = useRef<HistEntry[]>([]);
  const redoStack = useRef<HistEntry[]>([]);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  // Backing canvases for paint layers + last brush point + paint undo stacks.
  const paintCanvases = useRef<Record<string, HTMLCanvasElement>>({});
  const loadedPaint = useRef<Set<string>>(new Set());
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const painting = useRef(false);

  // Zoom management states for stylus/tablet precision controls
  const [zoomPercent, setZoomPercent] = useState(100); // 100% (exact fit) to 800%
  const [fitScale, setFitScale] = useState(0.15);
  const [workspaceSize, setWorkspaceSize] = useState({ w: 800, h: 600 });
  const scrollOuterRef = useRef<HTMLDivElement>(null);

  const scale = fitScale * (zoomPercent / 100);

  // Move function defined for layers order adjustments
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

  // Lazily create (and rehydrate from saved src) a paint layer's canvas.
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

  // Record the layers state onto the unified undo stack (clears redo).
  const recordLayers = useCallback((snapshot: StudioLayer[]) => {
    undoStack.current.push({ kind: "layers", layers: clone(snapshot) });
    if (undoStack.current.length > 80) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  // History — snapshot BEFORE a mutation, then apply (one entry per action).
  const commit = useCallback((updater: (ls: StudioLayer[]) => StudioLayer[]) => {
    setLayers((cur) => { recordLayers(cur); return updater(cur); });
  }, [recordLayers]);

  const restorePaint = (c: HTMLCanvasElement, dataUrl: string) => {
    const im = new window.Image(); im.src = dataUrl;
    im.onload = () => { const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0); redrawStage(); };
  };

  // One step back, honoring the true chronological order across paint + layers.
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

  // Keyboard: Cmd/Ctrl+Z undo, +Shift redo. Ignore while typing in fields.
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

  // Lock browser viewport to completely prevent horizontal and vertical page swiping/sliding
  useEffect(() => {
    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // Allow touch scrolling inside modal drawers OR the canvas viewport container
      if (target.closest('.overflow-y-auto') || target.closest('.canvas-scroll-container')) {
        return;
      }
      e.preventDefault();
    };

    // Lock page elements securely
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

  // Force safe-area background colors and meta tags to prevent browser viewport leaks / black margins
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

  // Handle dynamic scroll coordinates in a requestAnimationFrame tick to keep the canvas centered inside viewport during zoom transitions
  useEffect(() => {
    const outer = scrollOuterRef.current;
    if (!outer) return;

    const handle = requestAnimationFrame(() => {
      const viewW = outer.clientWidth;
      const viewH = outer.clientHeight;

      const stageW = artboardW * scale;
      const stageH = artboardH * scale;

      // Center scroll offsets
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
  // live patch (no history) for sliders mid-drag
  const livePatch = useCallback((id: string, patch: Partial<StudioLayer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  // Snap to artboard center while dragging + show alignment guides.
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

  // Centering: align the selected node to artboard center on an axis.
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
    const l: StudioLayer = { id: uid(), type: "text", name: "Text", visible: true, x: artboardW / 2 - 400, y: artboardH / 2, rotation: 0, opacity: 1, text: "Your text", fontSize: 200, fill: "#000000", fontStyle: "bold", fontFamily: "Space Mono" };
    commit((ls) => [...ls, l]); setSelectedId(l.id);
  };

  const addImageAt = (src: string, name: string, box?: { x: number; y: number; w: number; h: number }, blend?: BlendMode) => {
    const place = (w: number, h: number, x: number, y: number) => {
      const l: StudioLayer = { id: uid(), type: "image", name, visible: true, x, y, rotation: 0, opacity: 1, src, width: w, height: h, blend };
      commit((ls) => [...ls, l]); setSelectedId(l.id);
    };
    if (box) { place(box.w, box.h, box.x, box.y); return; }
    const im = new window.Image(); im.crossOrigin = "anonymous"; 
    im.src = src.includes("?") ? `${src}&cors=1` : `${src}?cors=1`;
    im.onload = () => {
      const ratio = im.width / im.height; const w = Math.min(artboardW * 0.7, im.width); const h = w / ratio;
      place(w, h, (artboardW - w) / 2, (artboardH - h) / 2);
    };
  };

  const uploadImage = (file: File) => { const r = new FileReader(); r.onload = () => addImageAt(r.result as string, file.name); r.readAsDataURL(file); };

  // Import a fabric/texture image and auto-pick the blend mode: light texture
  // -> Multiply, dark texture -> Screen (the "Overlay Strategy" from the brief).
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
        let lum = 0; for (let i = 0; i < d.length; i += 4) lum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
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

  // Ensure there's a paint layer to draw on; returns its id. When `create` is
  // true and none exists, one is added on the fly (so the bucket/brush never
  // silently no-op).
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
    // Pressure-modulated opacity (Procreate-style), on top of the brush opacity.
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, brushOpacity * (0.5 + pressure * 0.5)));
    const draw = (px: number, py: number) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, brushColor);
      g.addColorStop(0.75, brushColor);
      g.addColorStop(1, brushColor + "00");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    };
    draw(x, y);
    if (symmetry === "v") draw(artboardW - x, y);
    if (symmetry === "h") draw(x, artboardH - y);
    ctx.restore();
  };

  // interpolate between last and current point so fast strokes stay continuous.
  // The incoming point is first pulled toward the last drawn point by the
  // stabilizer amount — a moving-average smoother, like Procreate's stabilization.
  const strokeTo = (id: string, x: number, y: number, pressure: number) => {
    const last = lastPt.current;
    let tx = x, ty = y;
    if (last && stabilizer > 0) {
      const k = 1 - stabilizer; // higher stabilizer ⇒ smoother/laggier
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

  // Reference-layer flood fill (bucket). Boundaries come from the layer
  // flagged "reference" (its drawn lines); the fill paints into the active
  // paint layer. Falls back to the active layer's own pixels.
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
    const tol = fillTolerance * fillTolerance * 3; // squared tolerance (user-tunable)
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

  // Switch the active print placement: stash the current layers, load the
  // target placement's layers (or its persisted set), and reset history.
  const switchPlacement = (idx: number) => {
    if (!hasMulti || idx === activeP) return;
    placementLayers.current[activeP] = serializeLayers();
    setSelectedId(null);
    undoStack.current = []; redoStack.current = [];
    const next = placementLayers.current[idx] ?? (placements[idx]?.layers as StudioLayer[]) ?? [];
    setActiveP(idx);
    setLayers(next);
  };

  // Build the canvas payload for persistence: keep the product ref (variant,
  // print dims, placements) and store every placement's layers.
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

  // Capture the artboard at a TRUE target pixel width. Konva's pixelRatio
  // multiplies the current (scaled-down) stage size, so we divide the target
  // by the live stage width. `hideChrome` strips the garment/guides/handles
  // for a transparent print file; thumbnails keep the garment composited.
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
      toast.success("Published to Printful — run Sync (or wait for the heartbeat) to see it in the shop.");
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

  // Capture the design as a transparent print PNG and open the 3D garment view.
  const open3d = () => {
    if (layers.length === 0) { toast.error("Design something first"); return; }
    setSelectedId(null);
    // Defer a frame so the transformer/handles are gone before capture.
    requestAnimationFrame(() => {
      const uri = captureStage(1024, true);
      if (!uri) { toast.error("Could not render the design"); return; }
      setPreview3d(uri);
    });
  };

  // Photoreal on-model mockup of the exact print via the manufacturer's
  // mockup generator. Uploads the current flattened print, then renders.
  const fetchMockups = async (): Promise<string[]> => {
    if (product?.mfr !== "printful" || !product?.id || !product?.variant_id) {
      toast.error("Realistic mockups need a Printful product variant — recreate this project from the catalog.");
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

  const selected = layers.find((l) => l.id === selectedId);
  const pill = `flex items-center gap-1.5 text-[10px] font-medium px-3.5 py-2 rounded-full transition-all ${isDark ? "text-neutral-300 hover:bg-white/10" : "text-neutral-700 hover:bg-black/[0.06]"}`;
  const isHat = templateKey?.startsWith("hat");
  const isPoster = templateKey?.startsWith("poster");

  const defaultPa = isHat ? { x: 0.28, y: 0.32, w: 0.44, h: 0.36 } : isPoster ? { x: 0.06, y: 0.05, w: 0.88, h: 0.9 } : { x: 0.2, y: 0.14, w: 0.6, h: 0.62 };
  const pa = printArea || defaultPa;

  return (
    <div className={`admin-page fixed inset-0 z-50 flex flex-col font-mono select-none ${isDark ? "bg-black text-neutral-105" : "bg-white text-neutral-900"}`}>
      
      {/* ─────────────────────────────────────────────────────────────
         DESKTOP WORKSPACE HEADER (Hidden on mobile)
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex items-center gap-2 px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 shrink-0">
        <div className={`flex flex-wrap items-center gap-1 p-1 rounded-full ${isDark ? "bg-neutral-900/80 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl shadow-sm"}`}>
          <button onClick={onClose} className={pill}><X size={13} /> Close</button>
          <span className="w-px h-4 opacity-10 bg-current" />
          <button onClick={handleUndo} className={pill} title="Undo (⌘Z)"><Undo2 size={13} /></button>
          <button onClick={handleRedo} className={pill} title="Redo (⌘⇧Z)"><Redo2 size={13} /></button>
          <span className="w-px h-4 opacity-10 bg-current" />
          <button onClick={() => { setTool("select"); setRegionMode(false); }} className={pill + (tool === "select" ? (isDark ? " bg-white/15" : " bg-black/10") : "")} title="Select / move"><MousePointer2 size={13} /></button>
          <button onClick={() => { setTool("brush"); setRegionMode(false); }} className={pill + (tool === "brush" ? (isDark ? " bg-white/15" : " bg-black/10") : "")} title="Brush"><Paintbrush size={13} /></button>
          <button onClick={() => { setTool("fill"); setRegionMode(false); }} className={pill + (tool === "fill" ? (isDark ? " bg-white/15" : " bg-black/10") : "")} title="Flood fill (bucket)"><PaintBucket size={13} /></button>
          <span className="w-px h-4 opacity-10 bg-current" />
          <button onClick={addText} className={pill}><Type size={13} /> Text</button>
          <label className={pill + " cursor-pointer"}><ImagePlus size={13} /> Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} /></label>
          <label className={pill + " cursor-pointer"} title="Import fabric texture (auto Multiply/Screen)"><Wand2 size={13} /> Texture<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && importTexture(e.target.files[0])} /></label>
          <button onClick={addPaintLayer} className={pill}><Paintbrush size={13} /> Paint layer</button>
          <button onClick={() => { setRegionMode((v) => !v); setTool("select"); setSelectedId(null); }} className={pill + (regionMode ? (isDark ? " bg-white/15" : " bg-black/10") : "")} title="Draw a region for AI">
            <SquareDashed size={13} /> Region AI
          </button>
        </div>
        <div className="ml-auto flex items-center justify-end gap-2 flex-wrap">
          {/* Desktop Zoom Controller */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-100 dark:border-neutral-900 bg-[#f5f5f7]/30 dark:bg-[#111111]/30">
            <span className="text-[8px] opacity-50 uppercase tracking-widest">Zoom</span>
            <input 
              type="range" min={100} max={800} step={10} value={zoomPercent} 
              onChange={(e) => setZoomPercent(parseInt(e.target.value))} 
              className="w-20 sm:w-28 accent-[#6366f1] cursor-pointer"
            />
            <span className="text-[8px] font-bold opacity-60 w-8">{zoomPercent}%</span>
          </div>
          {/* Tablet/Stylus Maximizer Button */}
          <button onClick={() => setFullScreenCanvas(!fullScreenCanvas)} className={pill} title="Toggle Clean Canvas Mode">
            {fullScreenCanvas ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline">{fullScreenCanvas ? "Show Sidebars" : "Full Canvas"}</span>
          </button>
          {!product?.id && <button onClick={() => setMatchOpen(true)} className={`${pill} ${isDark ? "bg-neutral-900/80" : "bg-[#f5f5f7]/90 shadow-sm"}`} title="Match this design to the cheapest real blank"><Shirt size={13} /> Match blank</button>}
          <button onClick={open3d} className={`${pill} ${isDark ? "bg-neutral-900/80" : "bg-[#f5f5f7]/90 shadow-sm"}`} title="Live 3D garment view"><Box size={13} /> 3D View</button>
          {product?.mfr === "printful" && <button onClick={() => setEdmOpen(true)} className={`${pill} ${isDark ? "bg-neutral-900/80" : "bg-[#f5f5f7]/90 shadow-sm"}`} title="Design with Printful's Design Maker"><Wand2 size={13} /> Printful Maker</button>}
          <button onClick={exportPng} className={`${pill} ${isDark ? "bg-neutral-900/80" : "bg-[#f5f5f7]/90 shadow-sm"}`}><Download size={13} /> Export</button>
          <button onClick={save} disabled={saving} className={`${pill} ${isDark ? "bg-neutral-900/80" : "bg-[#f5f5f7]/90 shadow-sm"}`}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </button>
          <button onClick={publish} disabled={publishing} className={`flex items-center gap-1.5 text-[10px] font-semibold px-4 py-2.5 rounded-full ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
            {publishing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Publish
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         MOBILE MINIMALIST HEADER (Procreate Style)
         ───────────────────────────────────────────────────────────── */}
      <div className="flex lg:hidden items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 shrink-0 z-20 bg-white dark:bg-black">
        <div className="flex items-center gap-1">
          <button onClick={onClose} className="p-2 -ml-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
            <X size={18} />
          </button>
          <button onClick={handleUndo} className="p-2 text-neutral-600 dark:text-neutral-400" title="Undo"><Undo2 size={16} /></button>
          <button onClick={handleRedo} className="p-2 text-neutral-600 dark:text-neutral-400" title="Redo"><Redo2 size={16} /></button>
        </div>

        <span className="text-[10px] uppercase font-bold tracking-widest truncate max-w-[140px] text-neutral-400 dark:text-neutral-500">{projectName}</span>

        <div className="flex items-center gap-1">
          <button onClick={() => { setTool("select"); setRegionMode(false); }} className={`p-2 rounded-lg ${tool === "select" ? "bg-neutral-100 dark:bg-neutral-900 text-[#6366f1]" : "text-neutral-600 dark:text-neutral-400"}`}><MousePointer2 size={16} /></button>
          <button onClick={() => { setTool("brush"); setRegionMode(false); }} className={`p-2 rounded-lg ${tool === "brush" ? "bg-neutral-100 dark:bg-neutral-900 text-[#6366f1]" : "text-neutral-600 dark:text-neutral-400"}`}><Paintbrush size={16} /></button>
          <button onClick={() => { setTool("fill"); setRegionMode(false); }} className={`p-2 rounded-lg ${tool === "fill" ? "bg-neutral-100 dark:bg-neutral-900 text-[#6366f1]" : "text-neutral-600 dark:text-neutral-400"}`}><PaintBucket size={16} /></button>
          <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1" />
          <button onClick={() => setMobileSheet("add")} className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white" title="Add Assets"><Plus size={16} /></button>
          <button onClick={() => setMobileSheet("ai")} className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white" title="AI Magic"><Sparkles size={16} /></button>
          <button onClick={() => setMobileSheet("layers")} className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white" title="Layers"><Layers size={16} /></button>
          <button onClick={open3d} className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white" title="3D View"><Box size={16} /></button>
          <button onClick={() => setMobileSheet("export")} className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white" title="Export Menu"><Download size={16} /></button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         DESKTOP FLOATING CONTROLS (Hidden if Clean Canvas is active)
         ───────────────────────────────────────────────────────────── */}
      {/* AI prompt bar — hidden by default; only revealed when Region AI is
         pressed, so the workspace stays clean until AI is actually invoked. */}
      <div className={`hidden px-4 pb-2 shrink-0 mt-3 transition-all ${regionMode && !fullScreenCanvas ? "lg:block" : ""}`}>
        <div className={`flex items-center gap-2 px-2 py-2 rounded-full ${isDark ? "bg-neutral-900/70 backdrop-blur-xl" : "bg-[#f5f5f7]/90 backdrop-blur-xl shadow-sm border border-neutral-200/40"}`}>
          <Sparkles size={14} className="opacity-50 ml-2" />
          <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={regionMode ? "Type a prompt, then drag a region on the canvas…" : selected?.type === "image" ? "Reimagine the selected layer, or describe an image to generate…" : "Describe an image to generate…"}
            className="flex-1 bg-transparent text-[11px] px-2 focus:outline-none" />
          {aiBusy && <Loader2 size={14} className="animate-spin opacity-60" />}
          <button onClick={aiNewLayer} disabled={aiBusy} className={pill}><Sparkles size={12} /> New layer</button>
          {selected?.type === "image" && <button onClick={aiRegenerateSelected} disabled={aiBusy} className={pill}><RefreshCw size={12} /> Reimagine</button>}
        </div>
        {/* Apparel style presets — print-ready tuning for the generator */}
        <div className="flex items-center gap-1.5 mt-2 px-2 flex-wrap">
          <span className="text-[8px] uppercase tracking-widest opacity-40">Print style</span>
          {(["apparel", "streetwear", "vintage", "lineart", "embroidery", "none"] as const).map((s) => (
            <button key={s} onClick={() => setAiStyle(s)}
              className={`text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider transition-all ${
                aiStyle === s
                  ? (isDark ? "bg-white text-black" : "bg-black text-white")
                  : (isDark ? "text-neutral-400 hover:bg-white/10" : "text-neutral-600 hover:bg-black/[0.06]")
              }`}>
              {s === "none" ? "Raw" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Print-placement tabs — front / back / sleeves, each its own surface */}
      {hasMulti && (
        <div className="px-4 pb-2 shrink-0">
          <div className={`flex items-center gap-1 px-2 py-1.5 rounded-full w-fit ${isDark ? "bg-neutral-900/70" : "bg-[#e8e8ed]/70"}`}>
            <span className="text-[8px] uppercase tracking-widest opacity-40 px-2">Print area</span>
            {placements.map((p, i) => (
              <button key={p.placement + i} onClick={() => switchPlacement(i)}
                className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-full transition-all ${activeP === i ? (isDark ? "bg-white text-black" : "bg-white text-black shadow") : (isDark ? "text-neutral-400 hover:bg-white/10" : "text-neutral-600 hover:bg-black/[0.06]")}`}>
                {String(p.placement || `Area ${i + 1}`).replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brush controls — visible on both desktop & mobile when brush is selected */}
      {tool === "brush" && (
        <div className={`px-4 pb-2 shrink-0 transition-all ${fullScreenCanvas ? "lg:hidden" : ""}`}>
          <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-3 px-3 py-2 rounded-2xl md:rounded-full ${isDark ? "bg-neutral-900/70 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl shadow-sm border border-neutral-200/40"}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <Paintbrush size={13} className="opacity-50 ml-1" />
              <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="w-7 h-7 rounded-full bg-transparent border-0 cursor-pointer shrink-0" title="Brush color" />
              <div className="flex items-center gap-2">
                <span className="text-[9px] opacity-50 uppercase tracking-widest">Size</span>
                <input type="range" min={4} max={600} value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 sm:w-32" />
                <span className="text-[9px] opacity-60 w-8">{brushSize}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] opacity-50 uppercase tracking-widest">Opacity</span>
                <input type="range" min={0} max={100} value={Math.round(brushOpacity * 100)} onChange={(e) => setBrushOpacity(parseInt(e.target.value) / 100)} className="w-20 sm:w-28" />
                <span className="text-[9px] opacity-60 w-8">{Math.round(brushOpacity * 100)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] opacity-50 uppercase tracking-widest" title="Stroke stabilization">Smooth</span>
                <input type="range" min={0} max={90} value={Math.round(stabilizer * 100)} onChange={(e) => setStabilizer(parseInt(e.target.value) / 100)} className="w-20 sm:w-28" />
                <span className="text-[9px] opacity-60 w-8">{Math.round(stabilizer * 100)}</span>
              </div>
            </div>
            <span className="hidden md:block w-px h-4 opacity-10 bg-current" />
            <div className="flex items-center gap-2 justify-between md:justify-start mt-2 md:mt-0">
              <span className="text-[9px] opacity-50 uppercase tracking-widest">Symmetry</span>
              <button onClick={() => setSymmetry((s) => (s === "off" ? "v" : s === "v" ? "h" : "off"))}
                className={pill + (symmetry !== "off" ? (isDark ? " bg-white/15" : " bg-black/10") : "")}>
                {symmetry === "h" ? <FlipVertical2 size={13} /> : <FlipHorizontal2 size={13} />} {symmetry === "off" ? "Off" : symmetry === "v" ? "Vertical" : "Horizontal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fill (bucket) controls — color + match tolerance, like the brush panel */}
      {tool === "fill" && (
        <div className={`px-4 pb-2 shrink-0 transition-all ${fullScreenCanvas ? "lg:hidden" : ""}`}>
          <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-3 px-3 py-2 rounded-2xl md:rounded-full ${isDark ? "bg-neutral-900/70 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl shadow-sm border border-neutral-200/40"}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <PaintBucket size={13} className="opacity-50 ml-1" />
              <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="w-7 h-7 rounded-full bg-transparent border-0 cursor-pointer shrink-0" title="Fill color" />
              <div className="flex items-center gap-2">
                <span className="text-[9px] opacity-50 uppercase tracking-widest">Tolerance</span>
                <input type="range" min={0} max={128} value={fillTolerance} onChange={(e) => setFillTolerance(parseInt(e.target.value))} className="w-32 sm:w-40" />
                <span className="text-[9px] opacity-60 w-8">{fillTolerance}</span>
              </div>
            </div>
            <span className="hidden md:block w-px h-4 opacity-10 bg-current" />
            <span className="text-[9px] opacity-50 normal-case">Tap an area to fill. Flag a layer “Reference” to fill within its line boundaries.</span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         MOBILE & STYLUS PROCREATE FLOATING HORIZONTAL ZOOM CAPSULE
         Positions a standard horizontal range input (100% immune to touch blockages)
         ───────────────────────────────────────────────────────────── */}
      <div 
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[9999] lg:hidden flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md shadow-xl border border-neutral-100 dark:border-neutral-900 pointer-events-auto"
      >
        <span className="text-[8px] font-bold opacity-50 uppercase tracking-wider select-none">Zoom</span>
        <input 
          type="range" min={100} max={800} step={10} value={zoomPercent} 
          onChange={(e) => setZoomPercent(parseInt(e.target.value))} 
          className="w-36 sm:w-48 accent-[#6366f1] cursor-pointer"
        />
        <span className="text-[8px] font-bold opacity-60 select-none w-8">{zoomPercent}%</span>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         MAIN WORKSPACE AREA
         ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative">
        
        {/* Stage Canvas Area — canvas-scroll-container enables drawing panning */}
        <div ref={scrollOuterRef} className="flex-1 overflow-auto p-4 min-h-[380px] lg:min-h-0 relative canvas-scroll-container bg-[radial-gradient(ellipse_at_center,#fbfbfd_0%,#ececed_70%,#e2e2e6_100%)] dark:bg-[radial-gradient(ellipse_at_center,#161617_0%,#101011_65%,#070708_100%)]">
          {/* Centering Wrapper — mathematically centers smaller canvas, enables seamless scrollable space when zoomed in */}
          <div 
            className="relative block animate-fade-in"
            style={{
              width: `${Math.max(workspaceSize.w, artboardW * scale)}px`,
              height: `${Math.max(workspaceSize.h, artboardH * scale)}px`,
            }}
          >
            <div 
              className="absolute rounded-[28px] overflow-hidden shadow-2xl transition-all duration-75"
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
                style={{ cursor: tool === "brush" ? "crosshair" : "default" }}
                onMouseDown={(e) => {
                  if (tool === "fill") {
                    const p = e.target.getStage()!.getRelativePointerPosition()!;
                    floodFill(p.x, p.y);
                    return;
                  }
                  if (tool === "brush") {
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
                  if (tool === "brush" && painting.current) {
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
                  if (tool === "brush") {
                    const id = ensurePaintTarget(true);
                    if (!id) return;
                    const p = e.target.getStage()!.getRelativePointerPosition()!;
                    snapshotPaint(id); painting.current = true; lastPt.current = null;
                    strokeTo(id, p.x, p.y, 0.5);
                  }
                }}
                onTouchMove={(e) => {
                  if (tool === "brush" && painting.current) {
                    const id = layers.find((l) => l.id === selectedId)?.type === "paint" ? selectedId! : ensurePaintTarget();
                    if (id) { const p = e.target.getStage()!.getRelativePointerPosition()!; strokeTo(id, p.x, p.y, 0.5); }
                  }
                }}
                onTouchEnd={() => {
                  if (painting.current) { painting.current = false; lastPt.current = null; }
                }}
              >
                <Layer>
                  {/* Background Group — can be hidden cleanly during hi-res transparent exports */}
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

                  {/* Symmetry mirror guides */}
                  {tool === "brush" && symmetry === "v" && <Rect name="symmetry-guide" x={artboardW / 2 - 1} y={0} width={2} height={artboardH} fill="#6366f1" opacity={0.5} listening={false} />}
                  {tool === "brush" && symmetry === "h" && <Rect name="symmetry-guide" x={0} y={artboardH / 2 - 1} width={artboardW} height={2} fill="#6366f1" opacity={0.5} listening={false} />}

                  {/* Center alignment guides (while dragging) */}
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

        {/* ─────────────────────────────────────────────────────────────
           DESKTOP LAYER / PROPERTIES PANEL (Collapses in Full Canvas Mode)
           ───────────────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[300px] p-3 overflow-y-auto shrink-0 border-l border-neutral-100 dark:border-neutral-900 bg-white dark:bg-black transition-all ${
          fullScreenCanvas ? "lg:hidden" : "hidden lg:block"
        }`}>
          {selected && (
            <div className={`rounded-[20px] p-4 mb-3 ${isDark ? "bg-neutral-900/60" : "bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]"}`}>
              <p className="text-[9px] uppercase tracking-widest opacity-50 mb-3">Properties</p>
              {/* Centering / alignment */}
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-[8px] uppercase tracking-widest opacity-40 mr-1">Align</span>
                <button onClick={() => align("h")} title="Center horizontally" className={pill + " !px-2.5"}><AlignCenterVertical size={13} /></button>
                <button onClick={() => align("v")} title="Center vertically" className={pill + " !px-2.5"}><AlignCenterHorizontal size={13} /></button>
                <button onClick={() => align("both")} title="Center on artboard" className={pill + " !px-2.5"}><AlignVerticalJustifyCenter size={13} /></button>
              </div>
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
              {(selected.type === "image" || selected.type === "paint") && (
                <>
                  <div className="mt-3">
                    <p className="text-[8px] uppercase tracking-widest opacity-40 mb-1">Blend mode</p>
                    <select value={selected.blend || "source-over"} disabled={!!selected.clip} onChange={(e) => patchLayer(selected.id, { blend: e.target.value as BlendMode })}
                      className={`w-full bg-transparent border rounded-full px-3 py-1.5 text-[10px] ${isDark ? "border-neutral-800" : "border-[#E2E2E6]"} ${selected.clip ? "opacity-40" : ""}`}>
                      {BLENDS.map((b) => <option key={b} value={b} className="text-black">{BLEND_LABEL[b]}</option>)}
                    </select>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-[10px] cursor-pointer select-none">
                    <input type="checkbox" checked={!!selected.clip} onChange={(e) => patchLayer(selected.id, { clip: e.target.checked })} />
                    Clip to layers below
                  </label>
                  {selected.type === "paint" && (
                    <label className="mt-2 flex items-center gap-2 text-[10px] cursor-pointer select-none">
                      <input type="checkbox" checked={!!selected.reference}
                        onChange={(e) => { const on = e.target.checked; commit((ls) => ls.map((l) => l.type === "paint" ? { ...l, reference: l.id === selected.id ? on : false } : l)); }} />
                      Reference (bucket boundary)
                    </label>
                  )}
                  <div className="mt-3">
                    <p className="text-[8px] uppercase tracking-widest opacity-40 mb-1">Gaussian blur · {selected.blur || 0}</p>
                    <input type="range" min={0} max={100} value={selected.blur || 0}
                      onMouseDown={() => recordLayers(layers)}
                      onChange={(e) => livePatch(selected.id, { blur: parseInt(e.target.value) })} className="w-full" />
                  </div>
                </>
              )}
              <div className="mt-3">
                <p className="text-[8px] uppercase tracking-widest opacity-40 mb-1">Opacity</p>
                <input type="range" min={0} max={1} step={0.05} value={selected.opacity}
                  onMouseDown={() => recordLayers(layers)}
                  onChange={(e) => livePatch(selected.id, { opacity: parseFloat(e.target.value) })} className="w-full" />
              </div>
            </div>
          )}

          <div className={`rounded-[20px] p-4 ${isDark ? "bg-neutral-900/60" : "bg-neutral-50/70 border border-neutral-100 shadow-sm"}`}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-[9px] uppercase tracking-widest opacity-50">Layers · {layers.length}</p>
              <button onClick={addPaintLayer} className={pill}><Plus size={11} /> Paint Layer</button>
            </div>
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

      {/* ─────────────────────────────────────────────────────────────
         MOBILE TRANSLUCENT BOTTOM DRAWERS (Procreate Style)
         ───────────────────────────────────────────────────────────── */}
      {mobileSheet !== "none" && (
        <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm lg:hidden animate-fade-in" onClick={() => setMobileSheet("none")}>
          <div onClick={(e) => e.stopPropagation()} className={`fixed bottom-0 left-0 right-0 rounded-t-[32px] p-6 max-h-[80vh] overflow-y-auto border-t shadow-[0_-10px_40px_rgba(0,0,0,0.15)] transition-transform duration-300 ${isDark ? "bg-[#121212] border-neutral-850 text-neutral-105" : "bg-white border-[#D1D1D6] text-neutral-900"}`}>
            {/* Grab pull bar */}
            <div className="w-12 h-1.5 rounded-full mx-auto bg-neutral-200 dark:bg-neutral-800 mb-5" />

            {/* Mobile Actions/Add Sheet (+) */}
            {mobileSheet === "add" && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest mb-4 font-mono">Add Assets</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => { addText(); setMobileSheet("none"); }} className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-dashed hover:bg-neutral-50 dark:hover:bg-neutral-900 ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
                    <Type size={18} />
                    <span className="text-[8px] font-bold uppercase tracking-wider mt-1 font-mono">Text</span>
                  </button>

                  <label className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-dashed cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900 ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
                    <ImagePlus size={18} />
                    <span className="text-[8px] font-bold uppercase tracking-wider mt-1 font-mono">Photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { uploadImage(e.target.files[0]); setMobileSheet("none"); } }} />
                  </label>

                  <label className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-dashed cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900 ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
                    <Wand2 size={18} />
                    <span className="text-[8px] font-bold uppercase tracking-wider mt-1 font-mono">Texture</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { importTexture(e.target.files[0]); setMobileSheet("none"); } }} />
                  </label>
                </div>
              </div>
            )}

            {mobileSheet === "ai" && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={16} className="text-[#6366f1]" />
                  <h3 className="text-[11px] font-bold uppercase tracking-widest">AI Canvas Generation</h3>
                </div>
                <textarea 
                  value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={regionMode ? "Type a prompt, then drag a region on the canvas…" : selected?.type === "image" ? "Reimagine the selected layer, or describe an image to generate…" : "Describe an image to generate…"}
                  className={`w-full h-24 bg-transparent border rounded-2xl p-4 text-[11px] focus:outline-none mb-4 ${isDark ? "border-neutral-800" : "border-[#E2E2E6]"}`} 
                />
                <div className="flex gap-2">
                  <button onClick={() => { aiNewLayer(); setMobileSheet("none"); }} disabled={aiBusy} className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
                    {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} New Layer
                  </button>
                  {selected?.type === "image" && (
                    <button onClick={() => { aiRegenerateSelected(); setMobileSheet("none"); }} disabled={aiBusy} className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-300 hover:bg-white"}`}>
                      <RefreshCw size={13} /> Reimagine
                    </button>
                  )}
                </div>
              </div>
            )}

            {mobileSheet === "layers" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest">Active Layers ({layers.length})</h3>
                  <button onClick={() => { addPaintLayer(); setMobileSheet("none"); }} className={pill}><Plus size={11} /> Paint Layer</button>
                </div>
                {layers.length === 0 && <p className="text-[10px] opacity-40 py-6 text-center">Add text, image, or AI.</p>}
                <div className="space-y-2">
                  {[...layers].reverse().map((l) => (
                    <div key={l.id} onClick={() => setSelectedId(l.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer text-[11px] ${selectedId === l.id ? (isDark ? "bg-white/10" : "bg-black/[0.06]") : "hover:bg-current/5"}`}>
                      <button onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { visible: !l.visible }); }}>{l.visible ? <Eye size={14} /> : <EyeOff size={14} className="opacity-40" />}</button>
                      <span className="flex-1 truncate">{l.type === "text" ? (l.text || "Text") : l.name}</span>
                      <div className="flex gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); move(l.id, 1); }} className="p-1"><ArrowUp size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); move(l.id, -1); }} className="p-1"><ArrowDown size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); commit((ls) => ls.filter((x) => x.id !== l.id)); if (selectedId === l.id) setSelectedId(null); }} className="p-1 text-rose-500"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mobileSheet === "export" && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest mb-4 font-mono">Workspace Actions</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => { exportPng(); setMobileSheet("none"); }} className={`flex-col flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed hover:bg-neutral-50 dark:hover:bg-[#121212] ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
                    <Download size={18} />
                    <span className="text-[8px] font-bold uppercase tracking-wider mt-1 font-mono">PNG</span>
                  </button>
                  <button onClick={() => { save(); setMobileSheet("none"); }} className={`flex-col flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed hover:bg-neutral-50 dark:hover:bg-[#121212] ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
                    <Save size={18} />
                    <span className="text-[8px] font-bold uppercase tracking-wider mt-1 font-mono">Save</span>
                  </button>
                  <button onClick={() => { publish(); setMobileSheet("none"); }} className={`flex-col flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed hover:bg-neutral-50 dark:hover:bg-[#121212] ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
                    <Sparkles size={18} />
                    <span className="text-[8px] font-bold uppercase tracking-wider mt-1 font-mono">Publish</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blank-matching modal (traced/custom canvases) */}
      {matchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setMatchOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-[24px] border p-6 ${isDark ? "bg-neutral-955 border-neutral-850 text-neutral-100" : "bg-white border-neutral-200 text-neutral-900"}`}>
            <h2 className="text-[13px] font-semibold mb-1">Match to a real blank</h2>
            <p className={`text-[10px] mb-4 ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>Traced your own shirt? Pick the garment type — we'll find the closest blank across Printful & Apliiq and rank by price so you get the cheapest.</p>
            <div className="flex items-center gap-2 mb-4">
              <select value={matchType} onChange={(e) => setMatchType(e.target.value)}
                className={`flex-1 text-[11px] rounded-full px-3 py-2 border focus:outline-none ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"}`}>
                {["t-shirt", "hoodie", "sweatshirt", "tank", "long sleeve", "hat"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={runMatch} disabled={matchBusy}
                className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase rounded-full ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>
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
                    <p className={`text-[9px] uppercase tracking-wider ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>{d.mfr} · {d.colors?.length || 0} colors</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-semibold">${((d.min_cost_cents || 0) / 100).toFixed(2)}</p>
                    {i === 0 && <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 uppercase tracking-widest">Cheapest</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3D garment preview (Three.js, lazy/client-only) */}
      {preview3d && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 text-white"><Loader2 className="animate-spin" /></div>}>
          <Garment3DPreview design={preview3d} isDark={isDark} onClose={() => setPreview3d(null)}
            canMockup={product?.mfr === "printful" && !!product?.variant_id}
            printWidthIn={product?.print?.width_in ?? null}
            printHeightIn={product?.print?.height_in ?? null}
            fetchMockups={fetchMockups} />
        </Suspense>
      )}

      {/* Printful Embedded Design Maker (hybrid alongside our own AI/paint) */}
      {edmOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 text-white"><Loader2 className="animate-spin" /></div>}>
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

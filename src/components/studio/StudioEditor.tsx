// ─────────────────────────────────────────────────────────────
//  Luveni GM — StudioEditor (Procreate Hand-Book Masterpiece)
//  Free, Konva-powered design editor. Layers, text, images,
//  transform, undo/redo, AI new-layer, and region-select AI.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { Stage, Layer, Image as KImage, Text as KText, Rect, Transformer, Group, Line } from "react-konva";
import Konva from "konva";
import {
  Type, ImagePlus, Sparkles, Trash2, Eye, EyeOff, ArrowUp, ArrowDown,
  Save, Download, Loader2, Wand2, X, RefreshCw, Undo2, Redo2, SquareDashed,
  Paintbrush, FlipHorizontal2, FlipVertical2, MousePointer2, PaintBucket,
  AlignCenterHorizontal, AlignCenterVertical, AlignVerticalJustifyCenter, Layers, Plus,
  Maximize2, Minimize2, Box, Shirt, Wrench, Eraser, Pipette, Grid, RefreshCcw, Hand, Share2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeRetailCents } from "@/lib/pricing";

const Garment3DPreview = lazy(() => import("./Garment3DPreview"));
const PrintfulDesignMaker = lazy(() => import("./PrintfulDesignMaker"));

export type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
export type BrushType = "round" | "textured" | "ink" | "charcoal";

export type StudioLayer = {
  id: string; type: "image" | "text" | "paint"; name: string; visible: boolean;
  x: number; y: number; rotation: number; opacity: number;
  src?: string; width?: number; height?: number;
  text?: string; fontSize?: number; fill?: string; fontStyle?: string; fontFamily?: string;
  blend?: BlendMode;
  clip?: boolean;   
  blur?: number;    
  reference?: boolean; 
  alphaLock?: boolean; 
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
const BLEND_ABBR: Record<BlendMode, string> = { "source-over": "N", multiply: "M", screen: "S", overlay: "O", darken: "D", lighten: "L" };

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

export default function StudioEditor({ projectId, initialCanvas, artboardW: artboardWProp, artboardH: artboardHProp, templateKey, templateImage: templateImageProp, canvasKind, projectName, priceCents, printArea: printAreaProp, onClose, isDark: isDarkProp }: Props) {
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
  const [activePopoverTab, setActivePopoverTab] = useState<string>("add"); 
  const [activeLayerSettingsId, setActiveLayerSettingsId] = useState<string | null>(null);

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

  // State Expansion for Procreate specifications
  const [tool, setTool] = useState<"select" | "brush" | "smudge" | "eraser" | "fill" | "eyedropper" | "lasso">("select");
  const [brushType, setBrushType] = useState<BrushType>("round");
  const [brushSize, setBrushSize] = useState(120);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushOpacity, setBrushOpacity] = useState(1);     
  const [stabilizer, setStabilizer] = useState(0.45);      
  const [symmetry, setSymmetry] = useState<"off" | "v" | "h">("off");
  const [fillTolerance, setFillTolerance] = useState(48); 
  const [, setPaintVersion] = useState(0);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  // Color selection history stack
  const [colorHistory, setColorHistory] = useState<string[]>(["#000000", "#ffffff", "#3b82f6", "#ef4444", "#10b981", "#f59e0b"]);

  // Selections and Transform Sub-Menu States
  const [selectionModeType, setSelectionModeType] = useState<"freehand" | "rectangle">("freehand");
  const [uniformScaling, setUniformScaling] = useState(true);

  // Prefs tab adjustments matching official handbook variables
  const [isDark, setIsDark] = useState(isDarkProp);
  const [rightHandedInterface, setRightHandedInterface] = useState(false);
  const [brushCursorEnabled, setBrushCursorEnabled] = useState(true);
  const [selectionMaskVisibility, setSelectionMaskVisibility] = useState(40);

  // Freehand Lasso Selection Polygons
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [dashOffset, setDashOffset] = useState(0);

  // Viewport transformation offsets (Inertia-free responsive panning, scaling and rotation)
  const [canvasRotation, setCanvasRotation] = useState(0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Interactive sampling magnified pointer overlay
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [eyedropperPos, setEyedropperActivePos] = useState({ x: 0, y: 0 });
  const [eyedropperColorHex, setEyedropperColorHex] = useState("#ffffff");

  const stageRef = useRef<Konva.Stage>(null);
  const artboardGroupRef = useRef<Konva.Group>(null);
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

  // Multi-Touch Gesture Tracker references
  const lastTouchRef = useRef<{ dist: number; angle: number; x: number; y: number } | null>(null);

  const [zoomPercent, setZoomPercent] = useState(100); 
  const [fitScale, setFitScale] = useState(0.15);
  const [workspaceSize, setWorkspaceSize] = useState({ w: 800, h: 600 });
  const scrollOuterRef = useRef<HTMLDivElement>(null);

  const scale = fitScale * (zoomPercent / 100);

  // Marching ants selection line animation loop
  useEffect(() => {
    let id: any;
    if (tool === "lasso" && lassoPoints.length > 0) {
      const step = () => {
        setDashOffset((d) => (d - 0.4) % 12);
        id = requestAnimationFrame(step);
      };
      id = requestAnimationFrame(step);
    }
    return () => cancelAnimationFrame(id);
  }, [tool, lassoPoints]);

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

  // Gestures system: multi-finger mapping on standard target elements
  const handleStageTouchStart = (e: any) => {
    const numTouches = e.evt?.touches?.length || 0;
    if (numTouches === 2) {
      handleUndo();
      toast("Undo gesture registered", { duration: 900 });
    } else if (numTouches === 3) {
      handleRedo();
      toast("Redo gesture registered", { duration: 900 });
    } else if (numTouches === 4) {
      setFullScreenCanvas(prev => !prev);
      toast(fullScreenCanvas ? "Interface revealed" : "Clean canvas activated", { duration: 900 });
    }
  };

  // Inertia-free multi-touch gestures engine (supports continuous panning, scaling and rotation on tablets)
  const handleStageTouchMove = (e: any) => {
    const touches = e.evt?.touches;
    if (touches && touches.length === 2) {
      e.evt.preventDefault();
      const t1 = touches[0];
      const t2 = touches[1];
      
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;

      if (lastTouchRef.current) {
        const deltaDist = dist / lastTouchRef.current.dist;
        const deltaAngle = angle - lastTouchRef.current.angle;
        const deltaX = cx - lastTouchRef.current.x;
        const deltaY = cy - lastTouchRef.current.y;

        setZoomPercent((z) => Math.max(50, Math.min(1000, Math.round(z * deltaDist))));
        setCanvasRotation((r) => (r + deltaAngle) % 360);
        setPanOffset((p) => ({ x: p.x + deltaX, y: p.y + deltaY }));
      }

      lastTouchRef.current = { dist, angle, x: cx, y: cy };
    }
  };

  const handleStageTouchEnd = () => {
    lastTouchRef.current = null;
  };

  // Convert raw client coordinate vectors to dynamic artboard offsets through inverse matrices
  const getArtboardPointerPos = (): { x: number; y: number } | null => {
    const stage = stageRef.current;
    const group = artboardGroupRef.current;
    if (!stage || !group) return null;
    
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    try {
      const transform = group.getAbsoluteTransform().copy().invert();
      return transform.point(pos);
    } catch {
      return stage.getRelativePointerPosition();
    }
  };

  const sampleColorAtPos = (pos: { x: number; y: number }) => {
    const stage = stageRef.current;
    if (!stage) return;
    const ctx = stage.getLayers()[0].getContext();
    if (!ctx) return;
    try {
      const d = ctx.getImageData(pos.x * scale, pos.y * scale, 1, 1).data;
      if (d[3] === 0) return; 
      const hex = "#" + ((1 << 24) + (d[0] << 16) + (d[1] << 8) + d[2]).toString(16).slice(1);
      setBrushColor(hex);
      setEyedropperColorHex(hex);
      
      // Update color selection history
      setColorHistory((prev) => {
        const next = prev.filter((c) => c !== hex);
        next.unshift(hex);
        return next.slice(0, 12);
      });
    } catch {
      // safe fallback on CORS restrictions
    }
  };

  // Realistic color blending Smudge algorithm (draws sampled patches offset along path direction)
  const applySmudgeBrushDab = (ctx: CanvasRenderingContext2D, px: number, py: number, r: number, alpha: number) => {
    if (!lastPt.current) return;
    const lx = lastPt.current.x;
    const ly = lastPt.current.y;
    
    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = r * 2;
      tempCanvas.height = r * 2;
      const tctx = tempCanvas.getContext("2d")!;
      
      // Sample existing layout color space
      tctx.drawImage(ctx.canvas, lx - r, ly - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
      
      ctx.save();
      ctx.globalAlpha = alpha * 0.45;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(tempCanvas, px - r, py - r, r * 2, r * 2);
      ctx.restore();
    } catch {
      // safe fallback
    }
  };

  // High-fidelity Procedural Tip Shader
  const applyBrushProceduralDab = (ctx: CanvasRenderingContext2D, px: number, py: number, r: number, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    
    if (brushType === "round") {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, brushColor);
      g.addColorStop(0.75, brushColor);
      g.addColorStop(1, brushColor + "00");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    } else if (brushType === "textured") {
      ctx.fillStyle = brushColor;
      for (let i = 0; i < 6; i++) {
        const ox = (Math.random() - 0.5) * r * 1.2;
        const oy = (Math.random() - 0.5) * r * 1.2;
        const sr = r * (0.2 + Math.random() * 0.4);
        ctx.beginPath(); ctx.arc(px + ox, py + oy, sr, 0, Math.PI * 2); ctx.fill();
      }
    } else if (brushType === "ink") {
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
        const offset = (Math.random() - 0.5) * r * 0.3;
        const rx = px + Math.cos(angle) * (r + offset);
        const ry = py + Math.sin(angle) * (r + offset);
        if (angle === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
    } else if (brushType === "charcoal") {
      ctx.fillStyle = brushColor;
      for (let i = 0; i < 20; i++) {
        const ox = (Math.random() - 0.5) * r * 2;
        const oy = (Math.random() - 0.5) * r * 2;
        ctx.globalAlpha = alpha * 0.25;
        ctx.fillRect(px + ox, py + oy, Math.max(1, r * 0.1), Math.max(1, r * 0.1));
      }
    }
    
    ctx.restore();
  };

  const dab = (id: string, x: number, y: number, pressure: number) => {
    const c = paintCanvases.current[id]; if (!c) return;
    const ctx = c.getContext("2d")!;
    const r = (brushSize / 2) * (0.4 + pressure * 0.6);
    
    const activeLayer = layers.find((l) => l.id === id);
    ctx.save();
    
    // Lasso Boundary Masking Clip Path
    if (lassoPoints.length > 2) {
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      for (let i = 1; i < lassoPoints.length; i++) {
        ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
      }
      ctx.closePath();
      ctx.clip();
    }

    // Alpha Lock implementation (claps paint inside existing layout boundaries)
    if (activeLayer?.alphaLock) {
      ctx.globalCompositeOperation = "source-atop";
    } else if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    const draw = (px: number, py: number) => {
      if (tool === "eraser") {
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      } else if (tool === "smudge") {
        applySmudgeBrushDab(ctx, px, py, r, brushOpacity);
      } else {
        applyBrushProceduralDab(ctx, px, py, r, brushOpacity);
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
    
    // Check if point inside Lasso Selection stencil bounding loop
    const pointInLasso = (px: number, py: number): boolean => {
      if (lassoPoints.length < 3) return true;
      let inside = false;
      for (let i = 0, j = lassoPoints.length - 1; i < lassoPoints.length; j = i++) {
        const xi = lassoPoints[i].x, yi = lassoPoints[i].y;
        const xj = lassoPoints[j].x, yj = lassoPoints[j].y;
        const intersect = ((yi > py) !== (yj > py))
            && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const stack = [[x, y]];
    const seen = new Uint8Array(W * H);
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      const fi = cy * W + cx;
      if (seen[fi]) continue;
      seen[fi] = 1;
      const i = fi * 4;
      if (!match(i) || !pointInLasso(cx, cy)) continue;
      dp[i] = fill.r; dp[i + 1] = fill.g; dp[i + 2] = fill.b; dp[i + 3] = 255;
      if (cx > 0) stack.push([cx - 1, cy]);
      if (cx < W - 1) stack.push([cx + 1, cy]);
      if (cy > 0) stack.push([cx, cy - 1]);
      if (cy < H - 1) stack.push([cx, cy + 1]);
    }
    dctx.putImageData(dd, 0, 0);
    redrawStage();
  };

  // Merge active layer down onto the paint layer beneath it
  const handleMergeDown = (id: string) => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx <= 0) return; // Cannot merge bottom layer
    const lowerLayer = layers[idx - 1];
    const activeLayer = layers[idx];
    
    if (lowerLayer.type === "paint" && activeLayer.type === "paint") {
      const lowerCanvas = paintCanvases.current[lowerLayer.id];
      const activeCanvas = paintCanvases.current[activeLayer.id];
      if (lowerCanvas && activeCanvas) {
        snapshotPaint(lowerLayer.id);
        const ctx = lowerCanvas.getContext("2d")!;
        ctx.save();
        ctx.globalAlpha = activeLayer.opacity;
        ctx.globalCompositeOperation = gco(activeLayer);
        ctx.drawImage(activeCanvas, 0, 0);
        ctx.restore();
        
        // Remove merged active layer
        setLayers((cur) => cur.filter((l) => l.id !== id));
        setSelectedId(lowerLayer.id);
        redrawStage();
        toast.success("Layers merged successfully.");
      }
    } else {
      toast.error("Can only merge paint layers together.");
    }
  };

  const aiNewLayer = async () => {
    if (aiPrompt.trim().length < 3) { toast.error("Prompt too short"); return; }
    setAiBusy(true);
    try { const url = await runAi({ prompt: aiPrompt.trim(), width: 1024, height: 1024, persist: true, style: aiStyle }); if (url) { addImageAtDirect(url, aiPrompt.slice(0, 24)); setAiPrompt(""); toast.success("AI layer added."); } }
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

  // Convert Lasso coordinates to set a generation mask region
  const handleLassoRegionAi = async () => {
    if (lassoPoints.length < 3) {
      toast.error("Trace a lasso region before generating.");
      return;
    }
    if (aiPrompt.trim().length < 3) {
      toast.error("Describe the image to generate inside your lasso selection.");
      return;
    }
    setAiBusy(true);
    try {
      const xs = lassoPoints.map(p => p.x);
      const ys = lassoPoints.map(p => p.y);
      const minX = Math.max(0, Math.min(...xs)), maxX = Math.min(artboardW, Math.max(...xs));
      const minY = Math.max(0, Math.min(...ys)), maxY = Math.min(artboardH, Math.max(...ys));
      const w = maxX - minX;
      const h = maxY - minY;
      
      const longest = Math.max(w, h); const k = Math.min(1, 1024 / longest);
      const gw = Math.round(w * k); const gh = Math.round(h * k);
      const url = await runAi({ prompt: aiPrompt.trim(), width: gw, height: gh, persist: false, style: aiStyle });
      if (url) {
        addImageAtDirect(url, aiPrompt.slice(0, 24), { x: minX, y: minY, w, h });
        setAiPrompt("");
        setLassoPoints([]);
        toast.success("Generated directly into selection.");
      }
    } finally {
      setAiBusy(false);
    }
  };

  const finalizeRegionDirect = async (r: { x: number; y: number; w: number; h: number }) => {
    if (r.w < 40 || r.h < 40) { setRegion(null); return; }
    if (aiPrompt.trim().length < 3) { toast.error("Type a prompt first"); setRegion(null); return; }
    setAiBusy(true);
    try {
      const longest = Math.max(r.w, r.h); const k = Math.min(1, 1024 / longest);
      const gw = Math.round(r.w * k); const gh = Math.round(r.h * k);
      const url = await runAi({ prompt: aiPrompt.trim(), width: gw, height: gh, persist: false, style: aiStyle });
      if (url) {
        addImageAtDirect(url, aiPrompt.slice(0, 24), r);
        setAiPrompt("");
        toast.success("Generated into region.");
      }
    } finally {
      setAiBusy(false);
      setRegion(null);
      setRegionMode(false);
    }
  };

  const addImageAtDirect = (src: string, name: string, box?: { x: number; y: number; w: number; h: number }, blend?: BlendMode) => {
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
  };

  // Drag handler for custom vertical track pill sliders (matches visual feel of native iPadOS HUD element)
  const handleSliderDrag = (e: React.PointerEvent<HTMLDivElement>, type: "size" | "opacity") => {
    const rect = e.currentTarget.getBoundingClientRect();
    const calculateValue = (clientY: number) => {
      const relativeY = clientY - rect.top;
      const percent = Math.max(0, Math.min(1, 1 - (relativeY / rect.height)));
      if (type === "size") {
        setBrushSize(Math.round(percent * 599) + 1);
      } else {
        setBrushOpacity(percent);
      }
    };
    
    const onPointerMove = (moveEvent: PointerEvent) => {
      calculateValue(moveEvent.clientY);
    };
    
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    
    calculateValue(e.clientY);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const selectedLayer = layers.find((l) => l.id === selectedId);
  const getFlatLassoPoints = (): number[] => {
    const pts: number[] = [];
    lassoPoints.forEach((p) => pts.push(p.x, p.y));
    return pts;
  };

  // Restored missing print guide constraints
  const isHat = templateKey?.startsWith("hat");
  const isPoster = templateKey?.startsWith("poster");
  const defaultPa = isHat ? { x: 0.28, y: 0.32, w: 0.44, h: 0.36 } : isPoster ? { x: 0.06, y: 0.05, w: 0.88, h: 0.9 } : { x: 0.2, y: 0.14, w: 0.6, h: 0.62 };
  const pa = printArea || defaultPa;

  // Convert HSL values to exact HEX string
  const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col select-none overflow-hidden transition-colors duration-200 touch-none ${
      isDark ? "bg-[#09090b] text-[#efeff1]" : "bg-[#f4f5f7] text-[#1c1c1e]"
    }`}>
      
      {/* ─────────────────────────────────────────────────────────────
         THE ICONIC PROCREATE SYSTEM HEADER BAR
         ───────────────────────────────────────────────────────────── */}
      {!fullScreenCanvas && (
        <div className={`flex items-center justify-between px-6 h-14 border-b shrink-0 z-50 transition-all ${isDark ? "bg-[#1c1c1e]/95 border-neutral-900" : "bg-white/95 border-neutral-200 shadow-sm"}`}>
          
          {/* Left Cluster: Gallery & Utilities */}
          <div className="flex items-center gap-1">
            <button 
              onClick={onClose} 
              className="px-4 py-2 rounded-lg text-sm font-semibold tracking-wide text-indigo-500 hover:bg-indigo-500/10 transition-colors font-sans"
            >
              Gallery
            </button>
            
            <span className="w-px h-5 bg-neutral-300 dark:bg-neutral-800 mx-2" />

            {/* Actions (Wrench Popover) */}
            <button 
              onClick={() => togglePopover("actions")} 
              className={`p-2.5 rounded-lg transition-colors ${activePopover === "actions" ? "text-indigo-500 bg-indigo-500/10 shadow-sm" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-800"}`}
              title="Actions (Wrench)"
            >
              <Wrench size={18} />
            </button>

            {/* Adjustments (Wand Popover: AI & Filters) */}
            <button 
              onClick={() => togglePopover("adjustments")} 
              className={`p-2.5 rounded-lg transition-colors ${activePopover === "adjustments" ? "text-indigo-500 bg-indigo-500/10 shadow-sm" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-800"}`}
              title="Adjustments (Filters & AI)"
            >
              <Wand2 size={18} />
            </button>

            {/* Selection Lasso tool (marching ants ribbon) */}
            <button 
              onClick={() => { setTool("lasso"); setRegionMode(false); setSelectedId(null); }} 
              className={`p-2.5 rounded-lg transition-colors ${tool === "lasso" ? "text-indigo-500 bg-indigo-500/10 shadow-sm" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-800"}`}
              title="Selection Ribbon"
            >
              <SquareDashed size={18} />
            </button>

            {/* Transform selection arrow */}
            <button 
              onClick={() => { setTool("select"); setRegionMode(false); }} 
              className={`p-2.5 rounded-lg transition-colors ${tool === "select" && !regionMode ? "text-indigo-500 bg-indigo-500/10 shadow-sm" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-800"}`}
              title="Transform"
            >
              <MousePointer2 size={18} />
            </button>
          </div>

          {/* Right Cluster: Artistic Tools, Layers, Colors */}
          <div className="flex items-center gap-1.5">
            {/* Paint brush */}
            <button 
              onClick={() => { setTool("brush"); setRegionMode(false); }} 
              className={`p-2 rounded-lg transition-all ${tool === "brush" ? "text-[#007aff] bg-[#007aff]/10" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-800"}`}
              title="Paint Tool"
            >
              <Paintbrush size={18} />
            </button>

            {/* Smudge tool */}
            <button 
              onClick={() => { setTool("smudge"); setRegionMode(false); }} 
              className={`p-2 rounded-lg transition-all ${tool === "smudge" ? "text-[#007aff] bg-[#007aff]/10" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-800"}`}
              title="Smudge Tool"
            >
              <Hand size={18} />
            </button>

            {/* Eraser */}
            <button 
              onClick={() => { setTool("eraser"); setRegionMode(false); }} 
              className={`p-2 rounded-lg transition-all ${tool === "eraser" ? "text-[#007aff] bg-[#007aff]/10" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-800"}`}
              title="Eraser Tool"
            >
              <Eraser size={18} />
            </button>

            {/* Paint Bucket fill */}
            <button 
              onClick={() => { setTool("fill"); setRegionMode(false); }} 
              className={`p-2 rounded-lg transition-all ${tool === "fill" ? "text-[#007aff] bg-[#007aff]/10" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-800"}`}
              title="Flood Fill"
            >
              <PaintBucket size={18} />
            </button>

            <span className="w-px h-5 bg-neutral-300 dark:bg-neutral-850 mx-1" />

            {/* Layers panel toggler */}
            <button 
              onClick={() => togglePopover("layers")} 
              className={`p-2 rounded-lg transition-all relative ${activePopover === "layers" ? "text-[#007aff] bg-[#007aff]/10" : "text-neutral-400 hover:text-[#1c1c1e] dark:hover:text-[#efeff1]"}`}
              title="Layers Menu"
            >
              <Layers size={18} />
              {layers.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full" />
              )}
            </button>

            {/* Colors circle disk preview */}
            <button 
              onClick={() => togglePopover("colors")} 
              className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center justify-center"
              title="Colors Circle"
            >
              <div 
                className="w-6 h-6 rounded-full border border-neutral-350 dark:border-neutral-700 shadow-md relative"
                style={{ backgroundColor: brushColor }}
              />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         THE ICONIC FLOATING DOUBLE BAR (Custom dragging tracks - Left-handed or Right-handed layout)
         ───────────────────────────────────────────────────────────── */}
      <div className={`absolute top-[20%] bottom-[20%] flex flex-col items-center justify-between py-6 w-14 z-40 select-none pointer-events-none procreate-sidebar ${
        rightHandedInterface ? "right-6" : "left-6"
      }`}>
        
        {/* Procedural Size Slider */}
        <div className="flex flex-col items-center gap-2 group pointer-events-auto">
          <span className="text-[8px] font-bold opacity-45 uppercase tracking-wider text-neutral-500 select-none">Size</span>
          <div 
            onPointerDown={(e) => handleSliderDrag(e, "size")}
            className="h-32 w-5 bg-neutral-200/50 dark:bg-neutral-900/50 backdrop-blur-md rounded-full relative flex items-center justify-center overflow-hidden border border-neutral-350/10 shadow-lg cursor-ns-resize touch-none"
          >
            <div 
              className="absolute bottom-0 left-0 right-0 bg-[#007aff]/85 pointer-events-none transition-all duration-75"
              style={{ height: `${(brushSize / 600) * 100}%` }}
            />
            <div 
              className="absolute left-0 right-0 h-1 bg-white border border-neutral-400 pointer-events-none"
              style={{ bottom: `calc(${(brushSize / 600) * 100}% - 2px)` }}
            />
          </div>
          <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 tabular-nums">{brushSize}px</span>
        </div>

        {/* Central square modify shortcut (Eyedropper) */}
        <div className="flex flex-col items-center gap-2 pointer-events-auto">
          <button 
            onClick={() => {
              setTool(tool === "eyedropper" ? "brush" : "eyedropper");
              toast(tool === "eyedropper" ? "Brush active" : "Sample color: Tap on canvas", { duration: 1500 });
            }}
            className={`w-9 h-9 rounded-xl backdrop-blur-md border border-neutral-350/10 shadow-md flex items-center justify-center transition-all ${
              tool === "eyedropper" ? "bg-[#007aff] text-white shadow-[#007aff]/20" : "bg-neutral-200/70 dark:bg-neutral-900/70 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-350/50 dark:hover:bg-neutral-800/50"
            }`}
            title="Modify / Eyedropper"
          >
            <Pipette size={15} />
          </button>
        </div>

        {/* Procedural Opacity Slider */}
        <div className="flex flex-col items-center gap-2 group pointer-events-auto">
          <span className="text-[8px] font-bold opacity-45 uppercase tracking-wider text-neutral-500 select-none">Opac</span>
          <div 
            onPointerDown={(e) => handleSliderDrag(e, "opacity")}
            className="h-32 w-5 bg-neutral-200/50 dark:bg-neutral-900/50 backdrop-blur-md rounded-full relative flex items-center justify-center overflow-hidden border border-neutral-350/10 shadow-lg cursor-ns-resize touch-none"
          >
            <div 
              className="absolute bottom-0 left-0 right-0 bg-[#007aff]/85 pointer-events-none transition-all duration-75"
              style={{ height: `${brushOpacity * 100}%` }}
            />
            <div 
              className="absolute left-0 right-0 h-1 bg-white border border-neutral-400 pointer-events-none"
              style={{ bottom: `calc(${brushOpacity * 100}% - 2px)` }}
            />
          </div>
          <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 tabular-nums">{Math.round(brushOpacity * 100)}%</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         CONTEXT-SENSITIVE HORIZONTAL TWEAK BAR (Always visible under header)
         ───────────────────────────────────────────────────────────── */}
      {!fullScreenCanvas && (
        <div className={`px-6 py-2 border-b shrink-0 flex items-center justify-between gap-3 flex-wrap ${isDark ? "bg-[#18181b] border-neutral-900" : "bg-[#f4f5f7] border-neutral-200"}`}>
          
          {/* Brush/Eraser Settings */}
          {(tool === "brush" || tool === "eraser" || tool === "smudge") && (
            <div className="flex items-center gap-4 flex-wrap text-xs font-semibold animate-fade-in">
              <span className="text-[10px] opacity-50 uppercase tracking-widest">Brush tip</span>
              <div className="flex bg-neutral-200 dark:bg-neutral-800 p-0.5 rounded-full">
                {(["round", "textured", "ink", "charcoal"] as const).map((b) => (
                  <button key={b} onClick={() => setBrushType(b)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${brushType === b ? "bg-[#007aff] text-white" : "text-neutral-500"}`}>
                    {b}
                  </button>
                ))}
              </div>
              <span className="w-px h-4 bg-neutral-300 dark:bg-neutral-850" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] opacity-50 uppercase">Stabilizer</span>
                <input type="range" min={0} max={90} value={Math.round(stabilizer * 100)} onChange={(e) => setStabilizer(parseInt(e.target.value) / 100)} className="w-20 accent-[#007aff]" />
                <span className="tabular-nums">{Math.round(stabilizer * 100)}%</span>
              </div>
              <span className="w-px h-4 bg-neutral-300 dark:bg-neutral-850" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] opacity-50 uppercase">Symmetry</span>
                <button onClick={() => setSymmetry((s) => (s === "off" ? "v" : s === "v" ? "h" : "off"))} className="text-[#007aff] hover:underline uppercase text-[10px]">
                  {symmetry === "off" ? "Off" : symmetry === "v" ? "Vertical" : "Horizontal"}
                </button>
              </div>
            </div>
          )}

          {/* Bucket Fill Settings */}
          {tool === "fill" && (
            <div className="flex items-center gap-4 text-xs font-semibold animate-fade-in">
              <span className="text-[10px] opacity-50 uppercase tracking-widest font-mono">Flood tolerance</span>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={128} value={fillTolerance} onChange={(e) => setFillTolerance(parseInt(e.target.value))} className="w-24 accent-[#007aff]" />
                <span className="tabular-nums">{fillTolerance}</span>
              </div>
            </div>
          )}

          {/* Lasso Active State Indicators */}
          {tool === "lasso" && (
            <div className="flex items-center gap-4 text-xs font-semibold animate-fade-in">
              <span className="text-[10px] opacity-50 uppercase tracking-widest font-mono">Lasso Select</span>
              {lassoPoints.length > 2 ? (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓ Selection closed</span>
                  <button onClick={() => setLassoPoints([])} className="text-[9px] uppercase font-bold text-rose-500 hover:underline px-2.5 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/5">
                    Clear Selection
                  </button>
                </div>
              ) : (
                <span className="text-neutral-400 font-normal animate-pulse">Freehand draw a loop. Strokes clip within lasso.</span>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] opacity-50 uppercase tracking-widest">Swatch</span>
            <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer shrink-0" />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         THE SELECTIONS COMPACT CONTROL PANEL (Ribbon HUD Action Bar)
         ───────────────────────────────────────────────────────────── */}
      {tool === "lasso" && !fullScreenCanvas && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-45 flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md shadow-xl border border-neutral-200/20 pointer-events-auto">
          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 select-none">Selection Modes</span>
          <button 
            onClick={() => setSelectionModeType("freehand")} 
            className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-full transition-all ${selectionModeType === "freehand" ? "bg-[#007aff] text-white" : "text-neutral-500"}`}
          >
            Freehand (Lasso)
          </button>
          <button 
            onClick={() => {
              setSelectionModeType("rectangle");
              setRegionMode(true);
            }} 
            className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-full transition-all ${selectionModeType === "rectangle" && regionMode ? "bg-[#007aff] text-white" : "text-neutral-500"}`}
          >
            Rectangle
          </button>

          <span className="w-px h-5 bg-neutral-200 dark:bg-neutral-800" />

          {lassoPoints.length >= 3 && (
            <button 
              onClick={handleLassoRegionAi} 
              className="flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold uppercase rounded-full bg-indigo-500 text-white"
            >
              <Sparkles size={11} /> AI Generate selection
            </button>
          )}

          <button 
            onClick={() => { setLassoPoints([]); setRegion(null); setRegionMode(false); }} 
            className="text-[9px] uppercase font-bold text-rose-500 hover:underline px-2"
          >
            Reset mask
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         THE TRANSFORM COMPACT CONTROL PANEL (Cursor Transform HUD Action Bar)
         ───────────────────────────────────────────────────────────── */}
      {tool === "select" && selectedLayer && !fullScreenCanvas && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-45 flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md shadow-xl border border-neutral-200/20 pointer-events-auto">
          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 select-none">Scale</span>
          <button 
            onClick={() => setUniformScaling(true)} 
            className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-full transition-all ${uniformScaling ? "bg-[#007aff] text-white" : "text-neutral-500"}`}
          >
            Uniform
          </button>
          <button 
            onClick={() => setUniformScaling(false)} 
            className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-full transition-all ${!uniformScaling ? "bg-[#007aff] text-white" : "text-neutral-500"}`}
          >
            Freeform
          </button>

          <span className="w-px h-5 bg-neutral-200 dark:bg-neutral-800" />

          <button onClick={() => { patchLayer(selectedLayer.id, { rotation: (selectedLayer.rotation + 45) % 360 }); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-400"><RefreshCcw size={13} /></button>
          <button onClick={() => { const sx = nodeRefs.current[selectedLayer.id]?.scaleX() || 1; patchLayer(selectedLayer.id, { x: selectedLayer.x + selectedLayer.width! * sx, width: selectedLayer.width, scaleX: -sx }); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-400"><FlipHorizontal2 size={13} /></button>
          <button onClick={() => { const sy = nodeRefs.current[selectedLayer.id]?.scaleY() || 1; patchLayer(selectedLayer.id, { y: selectedLayer.y + selectedLayer.height! * sy, height: selectedLayer.height, scaleY: -sy }); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-400"><FlipVertical2 size={13} /></button>
          
          <span className="w-px h-5 bg-neutral-200 dark:bg-neutral-800" />

          <button onClick={() => { patchLayer(selectedLayer.id, { x: 0, y: 0, width: artboardW, height: artboardH }); }} className="text-[9px] font-bold text-indigo-500 hover:underline uppercase">Fit to canvas</button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         THE ICONIC FLOATING POP-OVER DROPDOWNS (Wrench / Wand / Layers / Colors)
         ───────────────────────────────────────────────────────────── */}
      {activePopover !== "none" && !fullScreenCanvas && (
        <div className="absolute inset-0 z-[100] bg-transparent" onClick={() => setActivePopover("none")}>
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-20 rounded-[24px] border p-6 max-w-[345px] w-full shadow-2xl transition-all duration-150 animate-fade-in ${
              activePopover === "colors" || activePopover === "layers" ? "right-6" : "left-6"
            } ${isDark ? "bg-[#1c1c1e] border-neutral-900 text-neutral-100" : "bg-white border-neutral-200 text-[#1c1c1e]"}`}
          >
            {/* Popover grab notch */}
            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-850 rounded-full mx-auto mb-5" />

            {/* Actions Popover (Tabs match iPad Wrench options) */}
            {activePopover === "actions" && (
              <div className="space-y-4 font-sans">
                <div className="flex border-b border-neutral-200 dark:border-neutral-850 pb-2 mb-2">
                  {["add", "canvas", "share", "prefs"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActivePopoverTab(tab)}
                      className={`flex-1 text-center py-1 text-xs font-bold uppercase tracking-wider transition-all ${
                        activePopoverTab === tab 
                          ? "text-[#007aff] border-b-2 border-[#007aff]" 
                          : "text-neutral-400 hover:text-neutral-250"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* ADD TAB */}
                {activePopoverTab === "add" && (
                  <div className="space-y-3 animate-fade-in font-mono">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Insert Elements</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { addText(); setActivePopover("none"); }} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed text-neutral-500 hover:text-[#007aff] hover:border-[#007aff]/40 transition-colors">
                        <Type size={18} /> <span className="text-[10px] font-bold uppercase">Insert Text</span>
                      </button>
                      <label className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed text-neutral-500 hover:text-[#007aff] hover:border-[#007aff]/40 transition-colors cursor-pointer">
                        <ImagePlus size={18} /> <span className="text-[10px] font-bold uppercase">Insert Photo</span>
                        <input type="file" accept="image/*,.svg,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { uploadImage(e.target.files[0]); setActivePopover("none"); } }} />
                      </label>
                    </div>
                    <label className="w-full flex items-center justify-center gap-2 py-3 border border-dashed rounded-xl cursor-pointer text-neutral-500 hover:text-[#007aff] hover:border-[#007aff]/40 text-xs font-bold transition-all">
                      <Wand2 size={14} /> Import Texture Overlay
                      <input type="file" accept="image/*,.svg,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { importTexture(e.target.files[0]); setActivePopover("none"); } }} />
                    </label>
                  </div>
                )}

                {/* CANVAS TAB */}
                {activePopoverTab === "canvas" && (
                  <div className="space-y-3 animate-fade-in">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Sandbox Actions</p>
                    <button onClick={() => { open3d(); setActivePopover("none"); }} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                      <span className="flex items-center gap-2.5"><Box size={14} /> 3D Garment Sandbox</span>
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase">3D</span>
                    </button>
                    {product?.mfr === "printful" && (
                      <button onClick={() => { setEdmOpen(true); setActivePopover("none"); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                        <Wand2 size={14} /> Printful Creator Suite
                      </button>
                    )}
                    <span className="block h-px bg-neutral-200 dark:bg-neutral-800" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-60 font-semibold">Active Symmetry Guide</span>
                      <button onClick={() => setSymmetry((s) => (s === "off" ? "v" : s === "v" ? "h" : "off"))} className="font-bold text-[#007aff] hover:underline uppercase text-[11px]">
                        {symmetry === "off" ? "Disabled" : symmetry === "v" ? "Vertical" : "Horizontal"}
                      </button>
                    </div>
                  </div>
                )}

                {/* SHARE TAB */}
                {activePopoverTab === "share" && (
                  <div className="space-y-3 animate-fade-in">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Export Options</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={exportPng} className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        <Download size={13} /> Export PNG
                      </button>
                      <button onClick={save} disabled={saving} className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save State
                      </button>
                    </div>
                    <button onClick={publish} disabled={publishing} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase bg-[#007aff] text-white hover:bg-[#005bb5]">
                      {publishing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Publish Design
                    </button>
                  </div>
                )}

                {/* PREFS TAB - Identical custom toggles from Procreate Preferences section */}
                {activePopoverTab === "prefs" && (
                  <div className="space-y-4 animate-fade-in text-xs font-semibold text-neutral-400">
                    <p className="text-[10px] uppercase font-bold tracking-widest">Interface Appearance</p>
                    <div className="flex items-center justify-between">
                      <span>Light Interface Appearance</span>
                      <input 
                        type="checkbox" 
                        checked={!isDark} 
                        onChange={(e) => setIsDark(!e.target.checked)} 
                        className="rounded text-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Right-Hand Modification HUD</span>
                      <input 
                        type="checkbox" 
                        checked={rightHandedInterface} 
                        onChange={(e) => setRightHandedInterface(e.target.checked)} 
                        className="rounded text-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Show Active Brush Cursor Outline</span>
                      <input 
                        type="checkbox" 
                        checked={brushCursorEnabled} 
                        onChange={(e) => setBrushCursorEnabled(e.target.checked)} 
                        className="rounded text-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <span className="block h-px bg-neutral-200 dark:bg-neutral-800" />

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Selection Mask Visibility</span>
                        <span className="text-[10px]">{selectionMaskVisibility}%</span>
                      </div>
                      <input 
                        type="range" min={10} max={100} value={selectionMaskVisibility} 
                        onChange={(e) => setSelectionMaskVisibility(parseInt(e.target.value))} 
                        className="w-full accent-indigo-500"
                      />
                    </div>
                    {!product?.id && (
                      <button onClick={() => { setMatchOpen(true); setActivePopover("none"); }} className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-[#007aff] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider border border-indigo-500/20">
                        <Shirt size={13} /> Open Store Blank Matcher
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Adjustments Popover */}
            {activePopover === "adjustments" && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Filters & AI</p>
                {selectedLayer ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold">Selected: {selectedLayer.name}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold opacity-60">
                        <span>Gaussian Blur filter</span>
                        <span>{selectedLayer.blur || 0}%</span>
                      </div>
                      <input 
                        type="range" min={0} max={100} value={selectedLayer.blur || 0}
                        onMouseDown={() => recordLayers(layers)}
                        onChange={(e) => livePatch(selectedLayer.id, { blur: parseInt(e.target.value) })}
                        className="w-full accent-[#007aff]"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] opacity-50 py-2">Select an image/text layer to adjust filters.</p>
                )}

                <span className="block h-px bg-neutral-200 dark:bg-neutral-800" />
                
                <div className="space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide">AI Generation Suite</p>
                  <textarea 
                    value={aiPrompt} 
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe design layers or lasso regions to generate..."
                    className="w-full h-16 bg-neutral-100 dark:bg-neutral-900 border-0 rounded-xl p-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100 font-mono" 
                  />
                  <div className="flex gap-2">
                    {lassoPoints.length >= 3 ? (
                      <button onClick={handleLassoRegionAi} disabled={aiBusy} className="w-full py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500 text-white hover:bg-indigo-600 flex items-center justify-center gap-1">
                        {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate Into Lasso
                      </button>
                    ) : (
                      <button onClick={aiNewLayer} disabled={aiBusy} className="flex-1 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500 text-white hover:bg-indigo-600 flex items-center justify-center gap-1 font-sans">
                        {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate Layer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LAYERS POPOVER */}
            {activePopover === "layers" && (
              <div className="space-y-4 font-sans">
                <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-850 pb-2">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Layers stack</p>
                  <button onClick={addPaintLayer} className="text-xs font-bold text-indigo-500 hover:underline flex items-center gap-1">
                    <Plus size={12} /> New Layer
                  </button>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                  {[...layers].reverse().map((l) => (
                    <div 
                      key={l.id} 
                      onClick={() => {
                        setSelectedId(l.id);
                        setActiveLayerSettingsId((prev) => prev === l.id ? null : l.id);
                      }}
                      className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition-colors relative ${
                        selectedId === l.id 
                          ? "bg-indigo-50/70 border-indigo-100 dark:bg-[#2c2c2e] dark:border-neutral-700" 
                          : "border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-850"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { visible: !l.visible }); }} className="text-neutral-400">
                          {l.visible ? <Eye size={14} /> : <EyeOff size={14} className="opacity-40" />}
                        </button>
                        <span className="flex-1 text-[11px] font-semibold truncate flex items-center gap-1.5">
                          {l.clip && <span className="text-indigo-500 font-bold">↳</span>}
                          {l.type === "text" ? (l.text || "Text") : l.name}
                        </span>
                        
                        <span className="text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-neutral-400">
                          {BLEND_ABBR[l.blend || "source-over"]}
                        </span>
                      </div>

                      {/* Sliding Actions Flyout */}
                      {activeLayerSettingsId === l.id && selectedId === l.id && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2 text-[10px] text-neutral-500 animate-fade-in font-mono">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-400">Align Elements</span>
                            <div className="flex gap-1">
                              <button onClick={(e) => { e.stopPropagation(); align("h"); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-[#1a1a1c] rounded"><AlignCenterVertical size={11} /></button>
                              <button onClick={(e) => { e.stopPropagation(); align("v"); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-[#1a1a1c] rounded"><AlignCenterHorizontal size={11} /></button>
                              <button onClick={(e) => { e.stopPropagation(); align("both"); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-[#1a1a1c] rounded"><AlignVerticalJustifyCenter size={11} /></button>
                            </div>
                          </div>
                          <span className="block h-px bg-neutral-200 dark:bg-neutral-800" />
                          <div className="flex items-center justify-between">
                            <span>Clipping mask:</span>
                            <input type="checkbox" checked={!!l.clip} onChange={(e) => patchLayer(l.id, { clip: e.target.checked })} />
                          </div>

                          <div className="flex items-center justify-between">
                            <span>Alpha lock:</span>
                            <input type="checkbox" checked={!!l.alphaLock} onChange={(e) => patchLayer(l.id, { alphaLock: e.target.checked })} />
                          </div>
                          
                          {l.type === "paint" && (
                            <div className="flex items-center justify-between">
                              <span>Reference target:</span>
                              <input type="checkbox" checked={!!l.reference} onChange={(e) => commit((ls) => ls.map((x) => x.type === "paint" ? { ...x, reference: x.id === l.id ? e.target.checked : false } : x))} />
                            </div>
                          )}

                          {l.type === "text" && (
                            <div className="space-y-1.5 mt-1 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                              <input value={l.text} onChange={(e) => patchLayer(l.id, { text: e.target.value })} className="w-full text-[10px] bg-transparent border rounded p-1 text-neutral-200" />
                              <div className="flex justify-between items-center">
                                <input type="color" value={l.fill} onChange={(e) => patchLayer(l.id, { fill: e.target.value })} className="w-5 h-5 rounded cursor-pointer" />
                                <input type="number" value={Math.round(l.fontSize || 0)} onChange={(e) => patchLayer(l.id, { fontSize: parseInt(e.target.value) || 48 })} className="w-12 bg-transparent border rounded text-center text-neutral-200" />
                              </div>
                            </div>
                          )}

                          <span className="block h-px bg-neutral-200 dark:bg-neutral-800" />

                          <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                              <button onClick={(e) => { e.stopPropagation(); move(l.id, 1); }} className="hover:text-indigo-400 font-bold uppercase text-[8px]">Up</button>
                              <button onClick={(e) => { e.stopPropagation(); move(l.id, -1); }} className="hover:text-indigo-400 font-bold uppercase text-[8px]">Down</button>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleMergeDown(l.id); }} className="hover:text-indigo-400 font-bold uppercase text-[8px]">Merge Down</button>
                            <button onClick={(e) => { e.stopPropagation(); commit((ls) => ls.filter((x) => x.id !== l.id)); setSelectedId(null); }} className="text-rose-500 font-bold uppercase text-[8px]">Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Colors Swatches Popover */}
            {activePopover === "colors" && (
              <div className="space-y-4">
                <div className="flex border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-2 text-[10px] font-bold uppercase tracking-wider">
                  {["disc", "classic", "palette", "history"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setColorSelectorTab(t as any)}
                      className={`flex-1 text-center py-1 transition-all ${
                        colorSelectorTab === t 
                          ? "text-[#007aff] border-b-2 border-[#007aff]" 
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* COLOR DISC TAB */}
                {colorSelectorTab === "disc" && (
                  <div className="space-y-3 animate-fade-in flex flex-col items-center">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 font-mono">Interactive Disc</p>
                    
                    {/* High-fidelity color picker circular disk */}
                    <div className="relative w-44 h-44 rounded-full border border-neutral-300 dark:border-neutral-850 overflow-hidden shadow-inner flex items-center justify-center">
                      <div 
                        onPointerDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const cx = rect.left + rect.width / 2;
                          const cy = rect.top + rect.height / 2;
                          const dx = e.clientX - cx;
                          const dy = e.clientY - cy;
                          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                          const deg = angle < 0 ? angle + 360 : angle;
                          
                          // procedurally resolve HSL vectors mapping to HEX
                          const hexColor = hslToHex(deg, 85, 50);
                          setBrushColor(hexColor);
                        }}
                        className="absolute inset-0 cursor-crosshair"
                        style={{
                          background: `conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`
                        }}
                      />
                      <div className="w-24 h-24 rounded-full bg-white dark:bg-[#1c1c1e] z-10 border border-neutral-350 dark:border-neutral-800 relative flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full border border-neutral-350 dark:border-neutral-800" style={{ backgroundColor: brushColor }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* CLASSIC HSB SLIDERS TAB */}
                {colorSelectorTab === "classic" && (
                  <div className="space-y-4 animate-fade-in font-sans">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Classic Sliders</p>
                    <div className="space-y-3 text-[11px] font-semibold text-neutral-400">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Hue</span>
                        </div>
                        <input type="range" min={0} max={360} className="w-full accent-[#007aff]" onChange={(e) => setBrushColor(hslToHex(parseInt(e.target.value), 85, 50))} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Saturation</span>
                        </div>
                        <input type="range" min={0} max={100} className="w-full accent-[#007aff]" onChange={(e) => setBrushColor(hslToHex(180, parseInt(e.target.value), 50))} />
                      </div>
                    </div>
                  </div>
                )}

                {/* PALETTES TAB */}
                {colorSelectorTab === "palette" && (
                  <div className="space-y-3 animate-fade-in">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Presets Matrix</p>
                    <div className="grid grid-cols-6 gap-2">
                      {["#1c1c1e", "#3a3a3c", "#5c5c5e", "#aeaeaf", "#e5e5ea", "#ffffff", "#ff3b30", "#ff9500", "#ffcc00", "#4cd964", "#5ac8fa", "#007aff"].map((c) => (
                        <button key={c} onClick={() => setBrushColor(c)} className="w-8 h-8 rounded border border-neutral-300 dark:border-neutral-800 transition-transform active:scale-90" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* HISTORY PANEL TAB */}
                {colorSelectorTab === "history" && (
                  <div className="space-y-3 animate-fade-in">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">Sampled History</p>
                    <div className="grid grid-cols-6 gap-2">
                      {colorHistory.map((c, i) => (
                        <button key={c + i} onClick={() => setBrushColor(c)} className="w-8 h-8 rounded-full border border-neutral-350 dark:border-neutral-850 transition-transform active:scale-90" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         MAIN DIGITAL ARTWORK VIEWPORT (Supports Rotational & Gesture Offsets)
         ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        <div 
          ref={scrollOuterRef} 
          className="flex-1 overflow-auto p-4 min-h-[380px] canvas-scroll-container bg-[radial-gradient(ellipse_at_center,#18181a_0%,#09090b_65%,#000000_100%)] select-none"
        >
          <div 
            className="relative block"
            style={{
              width: `${Math.max(workspaceSize.w, artboardW * scale)}px`,
              height: `${Math.max(workspaceSize.h, artboardH * scale)}px`,
            }}
          >
            <div 
              className="absolute rounded-[24px] overflow-hidden shadow-2xl border border-neutral-850 bg-[#ffffff] transition-transform duration-75"
              style={{
                left: `${Math.max(0, (workspaceSize.w - artboardW * scale) / 2) + panOffset.x}px`,
                top: `${Math.max(0, (workspaceSize.h - artboardH * scale) / 2) + panOffset.y}px`,
                width: `${artboardW * scale}px`,
                height: `${artboardH * scale}px`,
              }}
            >
              <Stage
                ref={stageRef}
                width={artboardW * scale} height={artboardH * scale} scaleX={scale} scaleY={scale}
                style={{ cursor: tool === "brush" ? "crosshair" : tool === "eraser" ? "cell" : tool === "lasso" ? "crosshair" : "default" }}
                onTouchStart={handleStageTouchStart}
                onTouchMove={handleStageTouchMove}
                onTouchEnd={handleStageTouchEnd}
                onMouseDown={(e) => {
                  const p = getArtboardPointerPos();
                  if (!p) return;

                  if (tool === "eyedropper") {
                    sampleColorAtPos(p);
                    setEyedropperActive(true);
                    setEyedropperActivePos(stageRef.current!.getPointerPosition() || { x: 0, y: 0 });
                    return;
                  }
                  if (tool === "lasso") {
                    setLassoPoints([p]);
                    return;
                  }
                  if (tool === "fill") {
                    floodFill(p.x, p.y);
                    return;
                  }
                  if (tool === "brush" || tool === "eraser" || tool === "smudge") {
                    const id = ensurePaintTarget(true);
                    if (!id) { toast.error("Could not create a paint layer"); return; }
                    snapshotPaint(id); painting.current = true; lastPt.current = null;
                    strokeTo(id, p.x, p.y, (e.evt as any).pressure || 0.5);
                    return;
                  }
                  if (regionMode) { drawing.current = { x: p.x, y: p.y }; setRegion({ x: p.x, y: p.y, w: 0, h: 0 }); return; }
                  if (e.target === e.target.getStage() || (e.target as any).attrs?.name === "bg") setSelectedId(null);
                }}
                onMouseMove={(e) => {
                  const p = getArtboardPointerPos();
                  if (!p) return;

                  if (tool === "lasso" && e.evt.buttons === 1) {
                    setLassoPoints((pts) => [...pts, p]);
                    return;
                  }
                  if (tool === "eyedropper") {
                    if (e.evt.buttons === 1) {
                      sampleColorAtPos(p);
                      setEyedropperActivePos(stageRef.current!.getPointerPosition() || { x: 0, y: 0 });
                    }
                    return;
                  }
                  if ((tool === "brush" || tool === "eraser" || tool === "smudge") && painting.current) {
                    const id = layers.find((l) => l.id === selectedId)?.type === "paint" ? selectedId! : ensurePaintTarget();
                    if (id) { strokeTo(id, p.x, p.y, (e.evt as any).pressure || 0.5); }
                    return;
                  }
                  if (regionMode && drawing.current) { const s = drawing.current; setRegion({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); }
                }}
                onMouseUp={() => {
                  if (tool === "lasso") {
                    if (lassoPoints.length > 2) {
                      setLassoPoints((pts) => [...pts, pts[0]]);
                    }
                    return;
                  }
                  if (tool === "eyedropper") {
                    setEyedropperActive(false);
                    setTool("brush");
                    return;
                  }
                  if (painting.current) { painting.current = false; lastPt.current = null; return; }
                  if (regionMode && drawing.current && region) { finalizeRegionDirect(region); }
                }}
              >
                <Layer>
                  {/* Absolute transformed layout group */}
                  <Group 
                    ref={artboardGroupRef}
                    rotation={canvasRotation} 
                    x={artboardW / 2} y={artboardH / 2} 
                    offsetX={artboardW / 2} offsetY={artboardH / 2}
                  >
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

                    {(tool === "brush" || tool === "eraser" || tool === "smudge") && symmetry === "v" && <Rect name="symmetry-guide" x={artboardW / 2 - 1} y={0} width={2} height={artboardH} fill="#6366f1" opacity={0.5} listening={false} />}
                    {(tool === "brush" || tool === "eraser" || tool === "smudge") && symmetry === "h" && <Rect name="symmetry-guide" x={0} y={artboardH / 2 - 1} width={artboardW} height={2} fill="#6366f1" opacity={0.5} listening={false} />}

                    {guides.v && <Rect name="align-guide" x={artboardW / 2 - 1} y={0} width={2} height={artboardH} fill="#22d3ee" listening={false} />}
                    {guides.h && <Rect name="align-guide" x={0} y={artboardH / 2 - 1} width={artboardW} height={2} fill="#22d3ee" listening={false} />}

                    {region && <Rect x={region.x} y={region.y} width={region.w} height={region.h} stroke="#6366f1" strokeWidth={4} dash={[16, 12]} fill="rgba(99,102,241,0.08)" listening={false} />}
                    
                    {/* Render active Lasso selection polygon path */}
                    {lassoPoints.length > 1 && (
                      <Line 
                        points={getFlatLassoPoints()} 
                        stroke="#007aff" 
                        strokeWidth={2.5} 
                        dash={[6, 6]} 
                        dashOffset={dashOffset}
                        closed={lassoPoints.length > 2}
                        listening={false}
                      />
                    )}
                    
                    {/* Custom brush diameter preview outline cursor */}
                    {brushCursorEnabled && (tool === "brush" || tool === "eraser" || tool === "smudge") && stageRef.current && (
                      <Line 
                        points={(() => {
                          const pts: number[] = [];
                          const artboardPointer = getArtboardPointerPos();
                          if (!artboardPointer) return [];
                          const cx = artboardPointer.x;
                          const cy = artboardPointer.y;
                          const r = brushSize / 2;
                          for (let angle = 0; angle <= Math.PI * 2; angle += 0.2) {
                            pts.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                          }
                          return pts;
                        })()}
                        stroke={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}
                        strokeWidth={1}
                        closed
                        listening={false}
                      />
                    )}

                    <Transformer
                      ref={trRef} rotateEnabled keepRatio={uniformScaling}
                      enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]}
                      anchorCornerRadius={20} borderStroke="#6366f1" anchorStroke="#6366f1" anchorSize={14}
                      boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
                    />
                  </Group>
                </Layer>
              </Stage>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         THE PROCREATE SAMPLING MAGNIFICATION HUD
         ───────────────────────────────────────────────────────────── */}
      {eyedropperActive && (
        <div 
          className="absolute pointer-events-none rounded-full border-4 border-[#1c1c1e] shadow-2xl flex items-center justify-center overflow-hidden z-[200] animate-fade-in"
          style={{
            left: `${eyedropperPos.x - 45}px`,
            top: `${eyedropperPos.y - 120}px`,
            width: "90px",
            height: "90px",
          }}
        >
          {/* Half-moon segmented colors (Top = New Color, Bottom = Old Color) */}
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1" style={{ backgroundColor: eyedropperColorHex }} />
            <div className="flex-1" style={{ backgroundColor: brushColor }} />
          </div>
          <div className="absolute w-2 h-2 rounded-full bg-white border border-neutral-800" />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         INTEGRATED SYSTEM ZOOM, PAN, AND ROTATE CONTROLLERS
         ───────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md shadow-xl border border-neutral-200/20 pointer-events-auto">
        
        {/* Zoom Control Slider */}
        <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 select-none">Zoom</span>
        <input 
          type="range" min={50} max={1000} step={10} value={zoomPercent} 
          onChange={(e) => setZoomPercent(parseInt(e.target.value))} 
          className="w-20 sm:w-36 accent-indigo-500 cursor-pointer"
        />
        <span className="text-[10px] font-bold text-neutral-500 select-none w-8 tabular-nums">{zoomPercent}%</span>
        
        <span className="w-px h-5 bg-neutral-200 dark:bg-neutral-800" />

        {/* Rotate Control Slider */}
        <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 select-none">Rotate</span>
        <input 
          type="range" min={0} max={360} step={1} value={canvasRotation} 
          onChange={(e) => setCanvasRotation(parseInt(e.target.value))} 
          className="w-20 sm:w-36 accent-[#007aff] cursor-pointer"
        />
        <span className="text-[10px] font-bold text-neutral-500 select-none w-10 tabular-nums">{canvasRotation}°</span>

        <button 
          onClick={() => { setCanvasRotation(0); setPanOffset({ x: 0, y: 0 }); }} 
          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-[#007aff]"
          title="Reset Alignment"
        >
          <RefreshCcw size={12} />
        </button>

        <span className="w-px h-5 bg-neutral-200 dark:bg-neutral-800" />

        {/* Dynamic view switchers */}
        {(hasMulti || productPhoto) && (
          <div className="flex items-center gap-1.5">
            {productPhoto && (!hasMulti || activeP === 0) && (
              <button 
                onClick={() => setShowPhoto(!showPhoto)}
                className={`text-[9px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full ${showPhoto ? "bg-indigo-500 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"}`}
              >
                {showPhoto ? "Mockup" : "Template"}
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

        {lassoPoints.length > 0 && (
          <>
            <span className="w-px h-5 bg-neutral-200 dark:bg-neutral-800" />
            <button 
              onClick={() => setLassoPoints([])} 
              className="text-[9px] uppercase font-bold text-rose-500 hover:underline px-2"
              title="Clear lasso selection loop"
            >
              Clear Loop
            </button>
          </>
        )}

        <span className="w-px h-5 bg-neutral-200 dark:bg-neutral-800" />

        <button 
          onClick={() => setFullScreenCanvas(!fullScreenCanvas)}
          className="text-neutral-400 hover:text-[#007aff] transition-colors"
          title="Toggle Fullscreen Canvas"
        >
          {fullScreenCanvas ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
         MODALS & PORTALS (Attach Blanks / 3D previews / Printful Maker)
         ───────────────────────────────────────────────────────────── */}
      {matchOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setMatchOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-[24px] border p-6 ${isDark ? "bg-[#1c1c1e] border-neutral-800 text-neutral-100" : "bg-white border-neutral-200 text-[#1c1c1e]"}`}>
            <h2 className="text-[13px] font-semibold mb-1">Match to a real blank</h2>
            <p className="text-[10px] mb-4 text-neutral-500 font-sans">Pick a garment category to fetch and match cheapest options.</p>
            <div className="flex items-center gap-2 mb-4">
              <select value={matchType} onChange={(e) => setMatchType(e.target.value)}
                className={`flex-1 text-[11px] rounded-full px-3 py-2 border focus:outline-none ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"}`}>
                {["t-shirt", "hoodie", "sweatshirt", "tank", "long sleeve", "hat"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={runMatch} disabled={matchBusy}
                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase rounded-full bg-indigo-500 text-white hover:bg-indigo-600 font-sans">
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
                    <p className="text-[11px] font-medium truncate font-sans">{d.label}</p>
                    <p className="text-[9px] uppercase tracking-wider text-neutral-500">{d.mfr} · {d.colors?.length || 0} colors</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-semibold font-sans">${((d.min_cost_cents || 0) / 100).toFixed(2)}</p>
                    {i === 0 && <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 uppercase tracking-widest font-bold">Cheapest</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {preview3d && (
        <Suspense fallback={<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 text-white"><Loader2 className="animate-spin animate-infinite" /></div>}>
          <Garment3DPreview design={preview3d} isDark={isDark} onClose={() => setPreview3d(null)}
            canMockup={product?.mfr === "printful" && !!product?.variant_id}
            printWidthIn={product?.print?.width_in ?? null}
            printHeightIn={product?.print?.height_in ?? null}
            fetchMockups={fetchMockups} />
        </Suspense>
      )}

      {edmOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 text-white"><Loader2 className="animate-spin animate-infinite" /></div>}>
          <PrintfulDesignMaker
            productId={product?.id}
            onDesign={(url, name) => addImageAtDirect(url, name)}
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

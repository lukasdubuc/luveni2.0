// ─────────────────────────────────────────────────────────────
//  Luveni GM — StudioEditor (Procreate Hand-Book Masterpiece)
//  Free, Konva-powered design editor. Layers, text, images,
//  transform, undo/redo, AI new-layer, and region-select AI.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from "react";
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

export type BlendMode =
  | "source-over" | "multiply" | "screen" | "overlay"
  | "darken" | "lighten" | "color-dodge" | "color-burn"
  | "hard-light" | "soft-light" | "difference" | "exclusion"
  | "hue" | "saturation" | "color" | "luminosity"
  | "lighter" | "destination-over" | "destination-in" | "destination-out"
  | "destination-atop" | "source-in" | "source-out" | "source-atop"
  | "xor" | "copy";
export type BrushType =
  | "round" | "textured" | "ink" | "charcoal"
  | "pencil" | "airbrush" | "marker" | "spray" | "calligraphy" | "watercolor";

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

type GalleryProject = {
  id: string;
  projectName: string;
  priceCents: number;
  templateKey: string;
  canvasKind: string;
  artboardW: number;
  artboardH: number;
  layers: StudioLayer[];
  updatedAt: string;
};

const getProxyImageUrl = (url: string | null): string => {
  if (!url) return "";
  // Already proxied — don't double-wrap.
  if (url.includes("/functions/v1/proxy-image")) return url;
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

const BLENDS: BlendMode[] = [
  "source-over", "multiply", "screen", "overlay",
  "darken", "lighten", "color-dodge", "color-burn",
  "hard-light", "soft-light", "difference", "exclusion",
  "hue", "saturation", "color", "luminosity",
  "lighter", "destination-over", "destination-in", "destination-out",
  "destination-atop", "source-in", "source-out", "source-atop",
  "xor", "copy",
];
const BLEND_LABEL: Record<BlendMode, string> = {
  "source-over": "Normal", multiply: "Multiply", screen: "Screen", overlay: "Overlay",
  darken: "Darken", lighten: "Lighten", "color-dodge": "Color Dodge", "color-burn": "Color Burn",
  "hard-light": "Hard Light", "soft-light": "Soft Light", difference: "Difference", exclusion: "Exclusion",
  hue: "Hue", saturation: "Saturation", color: "Color", luminosity: "Luminosity",
  lighter: "Add (Glow)", "destination-over": "Behind", "destination-in": "Dest In", "destination-out": "Dest Out",
  "destination-atop": "Dest Atop", "source-in": "Source In", "source-out": "Source Out", "source-atop": "Clip",
  xor: "XOR", copy: "Replace",
};
const BLEND_ABBR: Record<BlendMode, string> = {
  "source-over": "N", multiply: "Mu", screen: "Sc", overlay: "Ov",
  darken: "Da", lighten: "Li", "color-dodge": "CD", "color-burn": "CB",
  "hard-light": "HL", "soft-light": "SL", difference: "Di", exclusion: "Ex",
  hue: "Hu", saturation: "Sa", color: "Co", luminosity: "Lu",
  lighter: "Ad", "destination-over": "Be", "destination-in": "DI", "destination-out": "DO",
  "destination-atop": "DA", "source-in": "SI", "source-out": "SO", "source-atop": "Cl",
  xor: "XO", copy: "Cp",
};

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
    // Proxy URLs already set CORS headers — don't add extra query params that corrupt them.
    // For direct CDN URLs we append a cache-buster/CORS hint.
    if (src.startsWith("data:") || src.includes("/functions/v1/proxy-image")) {
      im.src = src;
    } else {
      im.src = src.includes("?") ? `${src}&_c=1` : `${src}?_c=1`;
    }
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

export default function StudioEditor({ projectId: initialProjectId, initialCanvas, artboardW: artboardWProp, artboardH: artboardHProp, templateKey: templateKeyProp, templateImage: templateImageProp, canvasKind: canvasKindProp, projectName: projectNameProp, priceCents: priceCentsProp, printArea: printAreaProp, onClose, isDark: isDarkProp }: Props) {
  
  // Navigation state between Gallery and Editor
  const [currentView, setCurrentView] = useState<"gallery" | "editor">("editor");
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  // Gallery Context States
  const [galleryProjects, setGalleryProjects] = useState<GalleryProject[]>([
    {
      id: initialProjectId,
      projectName: projectNameProp,
      priceCents: priceCentsProp,
      templateKey: templateKeyProp,
      canvasKind: canvasKindProp || "canvas",
      artboardW: artboardWProp,
      artboardH: artboardHProp,
      layers: initialCanvas?.layers ?? [],
      updatedAt: new Date().toLocaleDateString()
    }
  ]);

  // Selected Active Editor States
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectName, setProjectName] = useState(projectNameProp);
  const [priceCents, setPriceCents] = useState(priceCentsProp);
  const [templateKey, setTemplateKey] = useState(templateKeyProp);
  const [canvasKind, setCanvasKind] = useState(canvasKindProp || "canvas");
  const [layers, setLayers] = useState<StudioLayer[]>(initialCanvas?.layers ?? []);

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStyle, setAiStyle] = useState<"apparel" | "streetwear" | "vintage" | "lineart" | "embroidery" | "none">("apparel");
  const [regionMode, setRegionMode] = useState(false);
  const [region, setRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [fullScreenCanvas, setFullScreenCanvas] = useState(false);
  const [activePopover, setActivePopover] = useState<"none" | "actions" | "adjustments" | "layers" | "colors">("none");
  const [activePopoverTab, setActivePopoverTab] = useState<string>("add"); 
  const [colorSelectorTab, setColorSelectorTab] = useState<"disc" | "classic" | "palette" | "history">("disc");
  const [activeLayerSettingsId, setActiveLayerSettingsId] = useState<string | null>(null);

  const [preview3d, setPreview3d] = useState<string | null>(null);
  const [edmOpen, setEdmOpen] = useState(false);

  // Grid / drawing guide overlay
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(100);

  // Adjustment values (applied live to selected paint layer via offscreen canvas)
  const [adjHue, setAdjHue] = useState(0);
  const [adjSat, setAdjSat] = useState(100);
  const [adjBri, setAdjBri] = useState(100);
  const [adjContrast, setAdjContrast] = useState(0);

  // Color harmony mode
  const [harmonyMode, setHarmonyMode] = useState<"none"|"comp"|"split"|"triadic"|"tetradic"|"analogous">("none");
  
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
  const [colorH, setColorH] = useState(0);
  const [colorS, setColorS] = useState(0);
  const [colorB, setColorB] = useState(0);
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
  const designGroupRef = useRef<Konva.Group>(null);
  // Persistent offscreen canvas that holds ONLY the design artwork (print-area,
  // transparent background) for live 3D projection — never the garment photo.
  const designCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  // QuickShape: raw stroke points + the layer pixels at stroke start, so a
  // held stroke can be cleaned up into a geometric primitive (Procreate-style).
  const strokePts = useRef<{ x: number; y: number }[]>([]);
  const strokeStartImg = useRef<ImageData | null>(null);
  const holdTimer = useRef<any>(null);
  const quickShapeId = useRef<string | null>(null);
  const [quickShapeHint, setQuickShapeHint] = useState<string | null>(null);

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
      if (l.src.startsWith("data:")) {
        im.src = l.src;
      } else {
        im.src = l.src.includes("?") ? `${l.src}&cors=1` : `${l.src}?cors=1`;
      }
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

  // Unified stage interaction pointer events targeting Kindle, Android and iOS
  const handlePointerDown = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;
    
    // Multi-touch navigation initialization
    const touches = e.evt?.touches;
    if (touches && touches.length >= 2) {
      const t1 = touches[0];
      const t2 = touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      lastTouchRef.current = { dist, angle, x: cx, y: cy };
      painting.current = false;
      return;
    }

    const p = getArtboardPointerPos();
    if (!p) return;

    if (tool === "eyedropper") {
      sampleColorAtPos(p);
      setEyedropperActive(true);
      setEyedropperActivePos(stage.getPointerPosition() || { x: 0, y: 0 });
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
      snapshotPaint(id);
      painting.current = true;
      lastPt.current = null;
      // QuickShape: remember the layer pixels + raw points for this stroke.
      strokePts.current = [{ x: p.x, y: p.y }];
      quickShapeId.current = id;
      if (tool === "brush") {
        const sc = paintCanvases.current[id]?.getContext("2d");
        try { strokeStartImg.current = sc ? sc.getImageData(0, 0, paintCanvases.current[id].width, paintCanvases.current[id].height) : null; }
        catch { strokeStartImg.current = null; }
      } else {
        strokeStartImg.current = null;
      }
      strokeTo(id, p.x, p.y, (e.evt as any).pressure || 0.5);
      return;
    }
    if (regionMode) { 
      drawing.current = { x: p.x, y: p.y }; 
      setRegion({ x: p.x, y: p.y, w: 0, h: 0 }); 
      return; 
    }
    if (e.target === stage || (e.target as any).attrs?.name === "bg") {
      setSelectedId(null);
    }
  };

  const handlePointerMove = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Handle touch gesture panning/zooming if 2 fingers are down
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
      return;
    }

    const p = getArtboardPointerPos();
    if (!p) return;

    if (tool === "lasso" && e.evt.buttons === 1) {
      setLassoPoints((pts) => [...pts, p]);
      return;
    }
    if (tool === "eyedropper") {
      if (e.evt.buttons === 1) {
        sampleColorAtPos(p);
        setEyedropperActivePos(stage.getPointerPosition() || { x: 0, y: 0 });
      }
      return;
    }
    if ((tool === "brush" || tool === "eraser" || tool === "smudge") && painting.current) {
      const id = layers.find((l) => l.id === selectedId)?.type === "paint" ? selectedId! : ensurePaintTarget();
      if (id) { strokeTo(id, p.x, p.y, (e.evt as any).pressure || 0.5); }
      // QuickShape: record point and (re)arm the hold-to-snap timer.
      if (tool === "brush" && strokeStartImg.current) {
        strokePts.current.push({ x: p.x, y: p.y });
        if (holdTimer.current) clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(tryQuickShape, 550);
      }
      return;
    }
    if (regionMode && drawing.current) { const s = drawing.current; setRegion({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); }
  };

  const handlePointerUp = () => {
    lastTouchRef.current = null;
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
    if (painting.current) {
      painting.current = false;
      lastPt.current = null;
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      strokeStartImg.current = null;
      strokePts.current = [];
      quickShapeId.current = null;
      return;
    }
    if (regionMode && drawing.current && region) { finalizeRegionDirect(region); }
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
      setColorFromHex(hex);
      setEyedropperColorHex(hex);
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
    } else if (brushType === "pencil") {
      // Graphite: hard-ish core + grainy speckle for tooth.
      ctx.fillStyle = brushColor;
      ctx.globalAlpha = alpha * 0.9;
      ctx.beginPath(); ctx.arc(px, py, r * 0.78, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha * 0.45;
      const grains = Math.max(6, Math.floor(r * 1.4));
      for (let i = 0; i < grains; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        ctx.fillRect(px + Math.cos(a) * d, py + Math.sin(a) * d, 1, 1);
      }
    } else if (brushType === "airbrush") {
      // Soft airbrush: wide feathered falloff, builds up on overlap.
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 1.15);
      g.addColorStop(0, brushColor + "66");
      g.addColorStop(0.5, brushColor + "22");
      g.addColorStop(1, brushColor + "00");
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r * 1.15, 0, Math.PI * 2); ctx.fill();
    } else if (brushType === "marker") {
      // Marker: flat opaque core with a translucent wet edge; multiply feel.
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = brushColor;
      ctx.beginPath(); ctx.arc(px, py, r * 0.92, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath(); ctx.arc(px, py, r * 1.08, 0, Math.PI * 2); ctx.fill();
    } else if (brushType === "spray") {
      // Spray paint: scattered dots within the radius.
      ctx.fillStyle = brushColor;
      const dots = Math.max(10, Math.floor(r * 3));
      for (let i = 0; i < dots; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r * 1.2;
        ctx.globalAlpha = alpha * (0.3 + Math.random() * 0.5);
        const sr = Math.random() * 1.6 + 0.4;
        ctx.beginPath(); ctx.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, sr, 0, Math.PI * 2); ctx.fill();
      }
    } else if (brushType === "calligraphy") {
      // Flat nib: an angled ellipse that gives thick/thin strokes by direction.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = brushColor;
      ctx.translate(px, py);
      ctx.rotate(-Math.PI / 4);
      ctx.scale(1, 0.32);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    } else if (brushType === "watercolor") {
      // Watercolor: layered soft blobs with low alpha that bloom on overlap.
      for (let i = 0; i < 4; i++) {
        const ox = (Math.random() - 0.5) * r * 0.8;
        const oy = (Math.random() - 0.5) * r * 0.8;
        const br = r * (0.7 + Math.random() * 0.6);
        const g = ctx.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, br);
        g.addColorStop(0, brushColor + "30");
        g.addColorStop(0.7, brushColor + "18");
        g.addColorStop(1, brushColor + "00");
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px + ox, py + oy, br, 0, Math.PI * 2); ctx.fill();
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

  // ── QuickShape ──────────────────────────────────────────────────────────────
  // Walk a list of points and stamp the brush along them at the normal spacing.
  const stampPath = (id: string, pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return;
    lastPt.current = null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (i === 0) { dab(id, p.x, p.y, 0.7); lastPt.current = { x: p.x, y: p.y }; continue; }
      const last = lastPt.current!;
      const dist = Math.hypot(p.x - last.x, p.y - last.y);
      const step = Math.max(2, brushSize * 0.18);
      const n = Math.ceil(dist / step);
      for (let j = 1; j <= n; j++) dab(id, last.x + ((p.x - last.x) * j) / n, last.y + ((p.y - last.y) * j) / n, 0.7);
      lastPt.current = { x: p.x, y: p.y };
    }
    redrawStage();
  };

  // Classify the raw stroke into line / ellipse / rectangle, returning clean points.
  const recognizeShape = (raw: { x: number; y: number }[]): { kind: string; pts: { x: number; y: number }[] } | null => {
    if (raw.length < 8) return null;
    const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const bw = maxX - minX, bh = maxY - minY;
    const diag = Math.hypot(bw, bh);
    if (diag < 24) return null;
    const A = raw[0], B = raw[raw.length - 1];
    const endGap = Math.hypot(B.x - A.x, B.y - A.y);

    // Path length
    let pathLen = 0;
    for (let i = 1; i < raw.length; i++) pathLen += Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y);

    // Straight line: endpoints span most of the path, low perpendicular deviation.
    if (endGap > pathLen * 0.86 && endGap > diag * 0.7) {
      return { kind: "line", pts: [A, B] };
    }

    const closed = endGap < diag * 0.28;
    if (!closed) return null;

    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

    // Rectangle vs ellipse: measure how well points hug the bbox edges.
    let edgeHits = 0;
    const tol = diag * 0.12;
    for (const p of raw) {
      const nearV = Math.abs(p.x - minX) < tol || Math.abs(p.x - maxX) < tol;
      const nearH = Math.abs(p.y - minY) < tol || Math.abs(p.y - maxY) < tol;
      if (nearV || nearH) edgeHits++;
    }
    const edgeRatio = edgeHits / raw.length;

    // Ellipse: distance-to-center fits the bbox ellipse equation well.
    const rx = bw / 2, ry = bh / 2;
    let ellipseErr = 0;
    for (const p of raw) {
      const v = ((p.x - cx) / (rx || 1)) ** 2 + ((p.y - cy) / (ry || 1)) ** 2;
      ellipseErr += Math.abs(v - 1);
    }
    ellipseErr /= raw.length;

    if (edgeRatio > 0.82 && ellipseErr > 0.18) {
      return { kind: "rectangle", pts: [
        { x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }, { x: minX, y: minY },
      ] };
    }
    if (ellipseErr < 0.22) {
      const pts: { x: number; y: number }[] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 48) pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
      return { kind: Math.abs(rx - ry) < diag * 0.06 ? "circle" : "ellipse", pts };
    }
    return null;
  };

  // Triggered when the pen is held still at the end of a stroke.
  const tryQuickShape = () => {
    const id = quickShapeId.current;
    if (!id || !painting.current) return;
    const shape = recognizeShape(strokePts.current);
    if (!shape) return;
    const c = paintCanvases.current[id];
    if (!c || !strokeStartImg.current) return;
    const ctx = c.getContext("2d")!;
    // Restore the layer to its pre-stroke state, then stamp the clean shape.
    ctx.putImageData(strokeStartImg.current, 0, 0);
    stampPath(id, shape.pts);
    setQuickShapeHint(shape.kind);
    setTimeout(() => setQuickShapeHint(null), 1100);
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

  const addPaintLayer = () => {
    const l: StudioLayer = { id: uid(), type: "paint", name: "Paint", visible: true, x: 0, y: 0, rotation: 0, opacity: 1, blend: "source-over" };
    getPaintCanvas(l);
    commit((ls) => [...ls, l]); setSelectedId(l.id); setTool("brush");
  };

  const createNewProject = (type: "canvas" | "apparel", templateKeyChoice: string, w = 1200, h = 1200) => {
    const id = uid();
    const newProj: GalleryProject = {
      id,
      projectName: `Untitled Canvas ${galleryProjects.length + 1}`,
      priceCents: 2400,
      templateKey: templateKeyChoice,
      canvasKind: type,
      artboardW: w,
      artboardH: h,
      layers: [
        { id: uid(), type: "paint", name: "Layer 1", visible: true, x: 0, y: 0, rotation: 0, opacity: 1, blend: "source-over" }
      ],
      updatedAt: new Date().toLocaleDateString()
    };
    
    setGalleryProjects((prev) => [newProj, ...prev]);
    loadProjectToEditor(newProj);
  };

  const loadProjectToEditor = (p: GalleryProject) => {
    setProjectId(p.id);
    setProjectName(p.projectName);
    setPriceCents(p.priceCents);
    setTemplateKey(p.templateKey);
    setCanvasKind(p.canvasKind);
    setLayers(p.layers);
    setSelectedId(null);
    setPanOffset({ x: 0, y: 0 });
    setCanvasRotation(0);
    setCurrentView("editor");
  };

  // Drag handler for custom vertical track pill sliders (matches visual feel of native iPadOS HUD element)
  const handleSliderDrag = (e: React.PointerEvent<HTMLDivElement>, type: "size" | "opacity") => {
    e.currentTarget.setPointerCapture(e.pointerId);
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
    
    const onPointerUp = (upEvent: PointerEvent) => {
      try {
        (e.currentTarget as any).releasePointerCapture(upEvent.pointerId);
      } catch {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    
    calculateValue(e.clientY);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Toggle dropdown layers popovers safely to avoid ReferenceError
  const togglePopover = (type: "actions" | "adjustments" | "layers" | "colors") => {
    setActivePopover((prev) => (prev === type ? "none" : type));
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

  // Verify and resolve template canvas backing transparency values
  const isTemplateProject = canvasKind !== "canvas" || !!templateImage;

  // HSB (0-360, 0-100, 0-100) → "#rrggbb"
  const hsbToHex = (h: number, s: number, b: number): string => {
    const S = s / 100, V = b / 100;
    const f = (n: number) => {
      const k = (n + h / 60) % 6;
      const val = V - V * S * Math.max(0, Math.min(k, 4 - k, 1));
      return Math.round(val * 255).toString(16).padStart(2, "0");
    };
    return `#${f(5)}${f(3)}${f(1)}`;
  };
  // "#rrggbb" → {h,s,b}
  const hexToHsb = (hex: string): { h: number; s: number; b: number } => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const bl = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, bl), min = Math.min(r, g, bl);
    const d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - bl) / d) % 6;
      else if (max === g) h = (bl - r) / d + 2;
      else h = (r - g) / d + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }
    const s = max ? Math.round((d / max) * 100) : 0;
    const bv = Math.round(max * 100);
    return { h, s, b: bv };
  };
  const setColorFromHex = (hex: string) => {
    setBrushColor(hex);
    const { h, s, b } = hexToHsb(hex);
    setColorH(h); setColorS(s); setColorB(b);
    setColorHistory((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 30));
  };
  const setColorFromHsb = (h: number, s: number, b: number) => {
    setColorH(h); setColorS(s); setColorB(b);
    const hex = hsbToHex(h, s, b);
    setBrushColor(hex);
    setColorHistory((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 30));
  };

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

  // ─── Color harmony computation ────────────────────────────────────────────
  const harmonyColors = useMemo((): string[] => {
    if (harmonyMode === "none") return [];
    const h = colorH;
    const offsets: Record<typeof harmonyMode, number[]> = {
      none: [],
      comp:     [180],
      split:    [150, 210],
      triadic:  [120, 240],
      tetradic: [90, 180, 270],
      analogous:[30, -30, 60, -60],
    };
    return (offsets[harmonyMode] || []).map((o) => hsbToHex((h + o + 360) % 360, colorS, colorB));
  }, [harmonyMode, colorH, colorS, colorB]);

  // ─── Adjustments (Hue/Sat/Brightness/Contrast on active paint layer) ───────
  const applyAdjustments = useCallback(() => {
    if (!selectedLayer || selectedLayer.type !== "paint") return;
    const c = paintCanvases.current[selectedLayer.id]; if (!c) return;
    snapshotPaint(selectedLayer.id);
    const ctx = c.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imageData.data;
    const hueDelta = adjHue / 360;
    const satMul = adjSat / 100;
    const briMul = adjBri / 100;
    const conFac = (259 * (adjContrast + 255)) / (255 * (259 - adjContrast));
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      // RGB → HSV
      let r = d[i] / 255, g = d[i+1] / 255, b = d[i+2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      let H = 0, S = max ? delta / max : 0, V = max;
      if (delta) {
        if (max === r) H = ((g - b) / delta) % 6;
        else if (max === g) H = (b - r) / delta + 2;
        else H = (r - g) / delta + 4;
        H /= 6; if (H < 0) H += 1;
      }
      H = (H + hueDelta + 1) % 1;
      S = Math.min(1, S * satMul);
      V = Math.min(1, V * briMul);
      // HSV → RGB
      const hi = Math.floor(H * 6), f = H * 6 - hi;
      const p = V * (1 - S), q = V * (1 - f * S), t2 = V * (1 - (1 - f) * S);
      let nr = 0, ng = 0, nb = 0;
      switch (hi % 6) {
        case 0: nr=V; ng=t2; nb=p; break; case 1: nr=q; ng=V; nb=p; break;
        case 2: nr=p; ng=V; nb=t2; break; case 3: nr=p; ng=q; nb=V; break;
        case 4: nr=t2; ng=p; nb=V; break; default: nr=V; ng=p; nb=q;
      }
      // Contrast
      d[i]   = Math.min(255, Math.max(0, Math.round(conFac * (nr * 255 - 128) + 128)));
      d[i+1] = Math.min(255, Math.max(0, Math.round(conFac * (ng * 255 - 128) + 128)));
      d[i+2] = Math.min(255, Math.max(0, Math.round(conFac * (nb * 255 - 128) + 128)));
    }
    ctx.putImageData(imageData, 0, 0);
    redrawStage();
    setAdjHue(0); setAdjSat(100); setAdjBri(100); setAdjContrast(0);
  }, [selectedLayer, adjHue, adjSat, adjBri, adjContrast]);

  // ─── Core layer mutators ───────────────────────────────────────────────────
  const patchLayer = (id: string, patch: Partial<StudioLayer>) => {
    commit((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const livePatch = (id: string, patch: Partial<StudioLayer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const serializeLayers = (): StudioLayer[] =>
    layers.map((l) => {
      if (l.type === "paint") {
        const c = paintCanvases.current[l.id];
        return { ...l, src: c?.toDataURL("image/png") ?? undefined };
      }
      return { ...l };
    });

  // ─── Paint canvas helpers ──────────────────────────────────────────────────
  const snapshotPaint = (id: string) => {
    const c = paintCanvases.current[id];
    if (!c) return;
    undoStack.current.push({ kind: "paint", id, data: c.toDataURL() });
    if (undoStack.current.length > 80) undoStack.current.shift();
    redoStack.current = [];
  };

  const ensurePaintTarget = (force = false): string | null => {
    const active = layers.find((l) => l.id === selectedId && l.type === "paint");
    if (active) return active.id;
    const top = [...layers].reverse().find((l) => l.type === "paint" && l.visible);
    if (top && !force) return top.id;
    const newLayer: StudioLayer = {
      id: uid(), type: "paint", name: "Paint", visible: true,
      x: 0, y: 0, rotation: 0, opacity: 1, blend: "source-over",
    };
    getPaintCanvas(newLayer);
    commit((ls) => [...ls, newLayer]);
    setSelectedId(newLayer.id);
    return newLayer.id;
  };

  // ─── Add layers ────────────────────────────────────────────────────────────
  const addText = () => {
    const l: StudioLayer = {
      id: uid(), type: "text", name: "Text", visible: true,
      x: artboardW / 2 - 200, y: artboardH / 2 - 30, rotation: 0, opacity: 1,
      text: "Edit me", fontSize: Math.round(artboardW * 0.06),
      fill: brushColor, fontStyle: "normal", fontFamily: "Space Mono", blend: "source-over",
    };
    commit((ls) => [...ls, l]);
    setSelectedId(l.id);
    setTool("select");
  };

  const addImageAtDirect = (url: string, name = "Design") => {
    const id = uid();
    const im = new window.Image();
    im.crossOrigin = "anonymous";
    im.src = url.startsWith("data:") ? url : `${url}${url.includes("?") ? "&" : "?"}cors=1`;
    im.onload = () => {
      const maxDim = Math.min(artboardW * 0.7, artboardH * 0.7);
      const ratio = im.naturalWidth / im.naturalHeight;
      const w = ratio > 1 ? maxDim : maxDim * ratio;
      const h = ratio > 1 ? maxDim / ratio : maxDim;
      const l: StudioLayer = {
        id, type: "image", name, visible: true,
        x: (artboardW - w) / 2, y: (artboardH - h) / 2,
        rotation: 0, opacity: 1, src: url, width: w, height: h, blend: "source-over",
      };
      commit((ls) => [...ls, l]);
      setSelectedId(id);
      setTool("select");
    };
  };

  const uploadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (src) addImageAtDirect(src, file.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsDataURL(file);
  };

  const importTexture = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (!src) return;
      const id = uid();
      const l: StudioLayer = {
        id, type: "image", name: "Texture Overlay", visible: true,
        x: 0, y: 0, rotation: 0, opacity: 0.6, src,
        width: artboardW, height: artboardH, blend: "overlay",
      };
      commit((ls) => [...ls, l]);
      setSelectedId(id);
    };
    reader.readAsDataURL(file);
  };

  // ─── Canvas alignment & snap ───────────────────────────────────────────────
  const snapDrag = (e: any) => {
    const node = e.target;
    const threshold = 12 / scale;
    const nx = node.x(), ny = node.y();
    const nw = node.width() * node.scaleX(), nh = node.height() * node.scaleY();
    let gx = false, gy = false;
    if (Math.abs(nx + nw / 2 - artboardW / 2) < threshold) {
      node.x(artboardW / 2 - nw / 2); gx = true;
    }
    if (Math.abs(ny + nh / 2 - artboardH / 2) < threshold) {
      node.y(artboardH / 2 - nh / 2); gy = true;
    }
    setGuides({ v: gx, h: gy });
  };

  const align = (dir: "h" | "v" | "both") => {
    if (!selectedLayer) return;
    const node = nodeRefs.current[selectedLayer.id];
    const w = node ? node.width() * (node.scaleX() || 1) : selectedLayer.width || 200;
    const h = node ? node.height() * (node.scaleY() || 1) : selectedLayer.height || 200;
    const patch: Partial<StudioLayer> = {};
    if (dir === "h" || dir === "both") patch.x = (artboardW - w) / 2;
    if (dir === "v" || dir === "both") patch.y = (artboardH - h) / 2;
    patchLayer(selectedLayer.id, patch);
  };

  // ─── Merge layers ──────────────────────────────────────────────────────────
  const handleMergeDown = (id: string) => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx === 0) return;
    const below = layers[idx - 1];
    if (below.type !== "paint" || layers[idx].type !== "paint") {
      toast("Can only merge paint layers"); return;
    }
    const topC = paintCanvases.current[id];
    const botC = paintCanvases.current[below.id];
    if (!topC || !botC) return;
    snapshotPaint(below.id);
    const ctx = botC.getContext("2d")!;
    ctx.save();
    ctx.globalCompositeOperation = (layers[idx].blend || "source-over") as GlobalCompositeOperation;
    ctx.globalAlpha = layers[idx].opacity;
    ctx.drawImage(topC, 0, 0);
    ctx.restore();
    commit((ls) => ls.filter((l) => l.id !== id));
    setSelectedId(below.id);
    redrawStage();
    toast.success("Merged");
  };

  // ─── Multi-placement (front/back/sleeve) ──────────────────────────────────
  const switchPlacement = (index: number) => {
    if (!hasMulti) return;
    placementLayers.current[activeP] = [...layers];
    setActiveP(index);
    setLayers(placementLayers.current[index] || []);
    setSelectedId(null);
  };

  // ─── Save / export / publish ───────────────────────────────────────────────
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const sLayers = serializeLayers();
      let thumbnail_url: string | null = null;
      try {
        const dataUrl = stageRef.current?.toDataURL({
          mimeType: "image/jpeg", quality: 0.65,
          pixelRatio: Math.min(600 / artboardW, 1),
        });
        if (dataUrl) {
          const blob = await (await fetch(dataUrl)).blob();
          const { data: up } = await supabase.storage.from("designs").upload(
            `thumbnails/${projectId}.jpg`, blob,
            { upsert: true, contentType: "image/jpeg" },
          );
          if (up?.path) {
            const { data: { publicUrl } } = supabase.storage.from("designs").getPublicUrl(up.path);
            thumbnail_url = publicUrl;
          }
        }
      } catch { /* skip thumbnail on error */ }
      const { error } = await supabase.from("studio_projects").update({
        canvas: { layers: sLayers, product: (initialCanvas as any)?.product ?? product ?? null },
        ...(thumbnail_url ? { thumbnail_url } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);
      if (error) throw error;
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const exportPng = () => {
    const stg = stageRef.current;
    if (!stg) return;
    const dataUrl = stg.toDataURL({
      mimeType: "image/png",
      pixelRatio: Math.min(3072 / artboardW, 2),
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${projectName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.png`;
    a.click();
  };

  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      await save();
      const { error } = await supabase.from("studio_projects").update({ status: "published" }).eq("id", projectId);
      if (error) throw error;
      toast.success("Published!");
    } catch (e: any) {
      toast.error(e.message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  // ─── AI generation ─────────────────────────────────────────────────────────
  const aiNewLayer = async () => {
    if (!aiPrompt.trim()) { toast.error("Enter a prompt"); return; }
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-image", {
        body: { prompt: aiPrompt.trim(), width: 1024, height: 1024, style: aiStyle },
      });
      const msg = await extractFnError(error, data);
      if (msg) { toast.error(msg); return; }
      if (!data?.image_url) { toast.error("No image returned"); return; }
      addImageAtDirect(data.image_url, aiPrompt.trim().substring(0, 40));
      setAiPrompt("");
      toast.success("AI layer added");
    } finally {
      setAiBusy(false);
    }
  };

  const handleLassoRegionAi = async () => {
    if (!aiPrompt.trim()) { toast.error("Enter a prompt"); return; }
    if (lassoPoints.length < 3) { toast.error("Draw a lasso first"); return; }
    setAiBusy(true);
    try {
      const xs = lassoPoints.map((p) => p.x);
      const ys = lassoPoints.map((p) => p.y);
      const bx = Math.max(0, Math.min(...xs)), by = Math.max(0, Math.min(...ys));
      const bw = Math.min(artboardW - bx, Math.max(...xs) - bx);
      const bh = Math.min(artboardH - by, Math.max(...ys) - by);
      const w = Math.round(bw), h = Math.round(bh);
      if (w < 10 || h < 10) { toast.error("Selection too small"); return; }
      const { data, error } = await supabase.functions.invoke("ai-generate-image", {
        body: { prompt: aiPrompt.trim(), width: Math.min(1024, w), height: Math.min(1024, h), style: aiStyle },
      });
      const msg = await extractFnError(error, data);
      if (msg) { toast.error(msg); return; }
      if (!data?.image_url) { toast.error("No image"); return; }
      const im = new window.Image();
      im.crossOrigin = "anonymous";
      im.src = data.image_url;
      im.onload = () => {
        const destId = ensurePaintTarget(true);
        if (!destId) return;
        const c = paintCanvases.current[destId];
        if (!c) return;
        snapshotPaint(destId);
        const ctx = c.getContext("2d")!;
        ctx.save();
        if (lassoPoints.length > 2) {
          ctx.beginPath();
          ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
          lassoPoints.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.clip();
        }
        ctx.drawImage(im, bx, by, w, h);
        ctx.restore();
        redrawStage();
      };
      setAiPrompt("");
      toast.success("Generated into selection");
    } finally {
      setAiBusy(false);
    }
  };

  const finalizeRegionDirect = (r: { x: number; y: number; w: number; h: number }) => {
    setRegion(r);
    drawing.current = null;
    setRegionMode(false);
  };

  // ─── 3D preview & mockups ──────────────────────────────────────────────────
  // Capture ONLY the design artwork inside the print area (transparent bg, no
  // garment photo) into a persistent offscreen canvas. This is what gets
  // projected onto the 3D garment — so the white product photo never appears.
  const updateDesignCanvas = useCallback((): HTMLCanvasElement | null => {
    const grp = designGroupRef.current;
    if (!grp) return null;
    const w = Math.max(1, pa.w * artboardW);
    const h = Math.max(1, pa.h * artboardH);
    const pr = Math.min(1400 / w, 2);
    let src: HTMLCanvasElement;
    try {
      src = grp.toCanvas({ x: pa.x * artboardW, y: pa.y * artboardH, width: w, height: h, pixelRatio: pr });
    } catch { return null; }
    let dst = designCanvasRef.current;
    if (!dst) { dst = document.createElement("canvas"); designCanvasRef.current = dst; }
    if (dst.width !== src.width || dst.height !== src.height) { dst.width = src.width; dst.height = src.height; }
    const ctx = dst.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, dst.width, dst.height);
    ctx.drawImage(src, 0, 0);
    return dst;
  }, [pa.x, pa.y, pa.w, pa.h, artboardW, artboardH]);

  const open3d = async () => {
    const stg = stageRef.current;
    if (!stg) { toast.error("Canvas not ready"); return; }
    try {
      // Seed the design-only canvas so the 3D viewer has artwork on first frame.
      updateDesignCanvas();
      // A flat fallback PNG (design only) for environments without live sync.
      const grp = designGroupRef.current;
      const dataUrl = grp
        ? grp.toCanvas({ x: pa.x * artboardW, y: pa.y * artboardH, width: Math.max(1, pa.w * artboardW), height: Math.max(1, pa.h * artboardH), pixelRatio: Math.min(2048 / (pa.w * artboardW), 2) }).toDataURL("image/png")
        : stg.toDataURL({ mimeType: "image/png", pixelRatio: Math.min(2048 / artboardW, 2) });
      setPreview3d(dataUrl);
    } catch {
      toast.error("Could not render preview");
    }
  };

  // Keep the design-only canvas live-refreshed while the 3D viewer is open.
  useEffect(() => {
    if (!preview3d) return;
    let raf = 0;
    const tick = () => { updateDesignCanvas(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [preview3d, updateDesignCanvas]);

  const fetchMockups = async (): Promise<string[]> => {
    if (!product?.mfr || product.mfr !== "printful" || !product.variant_id) return [];
    try {
      const designUrl = stageRef.current?.toDataURL({ mimeType: "image/png", pixelRatio: 1 }) ?? null;
      const { data, error } = await supabase.functions.invoke("generate-mockup", {
        body: { variantId: product.variant_id, designUrl },
      });
      if (error || !data?.mockups) return [];
      return (data.mockups as { url: string }[]).map((m) => m.url);
    } catch {
      return [];
    }
  };

  // Fixed padding and center allocations
  useEffect(() => {
    const fit = () => {
      const isMobile = window.innerWidth < 1024;
      const padW = (isMobile || fullScreenCanvas) ? 0 : 320; 
      const padH = 56; 
      const availW = Math.max(280, window.innerWidth - padW);
      const availH = Math.max(280, window.innerHeight - padH);
      
      setWorkspaceSize({ w: availW, h: availH });
      setFitScale(Math.min(availW / artboardW, availH / artboardH, 1));
    };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [artboardW, artboardH, fullScreenCanvas]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (mod && e.key === "s") { e.preventDefault(); save(); }
      else if (mod && e.key === "e") { e.preventDefault(); exportPng(); }
      else if (e.key === " ") { e.preventDefault(); setTool((t) => t === "select" ? "select" : t); }
      else if (e.key === "b") setTool("brush");
      else if (e.key === "e" && !mod) setTool("eraser");
      else if (e.key === "l") setTool("lasso");
      else if (e.key === "f") setTool("fill");
      else if (e.key === "i") setTool("eyedropper");
      else if (e.key === "v") setTool("select");
      else if (e.key === "Escape") setSelectedId(null);
      else if (mod && e.key === "d") { e.preventDefault(); if (selectedLayer) { const copy = { ...selectedLayer, id: uid(), x: selectedLayer.x + 20, y: selectedLayer.y + 20, name: selectedLayer.name + " Copy" }; commit((ls) => [...ls, copy]); setSelectedId(copy.id); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedLayer, layers]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col select-none overflow-hidden transition-colors duration-200 touch-none ${
      isDark ? "bg-[#09090b] text-[#efeff1]" : "bg-[#f4f5f7] text-[#1c1c1e]"
    }`}>
      
      {/* ─────────────────────────────────────────────────────────────
         THE ICONIC PROCREATE GALLERY VIEW (Restored & Highly Polished)
         ───────────────────────────────────────────────────────────── */}
      {currentView === "gallery" && (
        <div className="flex-1 flex flex-col overflow-y-auto bg-black p-8 animate-fade-in z-50 font-sans">
          
          {/* Gallery Top Navigation bar */}
          <div className="flex justify-between items-center mb-8 border-b border-neutral-900 pb-4">
            <span className="text-xl font-light tracking-wide text-neutral-350">Procreate Gallery</span>
            <div className="flex items-center gap-4 text-xs font-semibold text-neutral-400 relative">
              <button onClick={() => {
                const urlStr = prompt("Enter Custom Template Image URL:");
                if (urlStr) createNewProject("apparel", "custom-apliiq", 1200, 1200);
              }} className="hover:text-white uppercase tracking-wider">Import</button>
              
              <button 
                onClick={() => setShowPresetDropdown(!showPresetDropdown)} 
                className="hover:text-white uppercase tracking-wider flex items-center gap-1 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800"
              >
                <Plus size={14} /> New Canvas
              </button>

              {showPresetDropdown && (
                <div className="absolute right-0 top-10 bg-[#1c1c1e] border border-neutral-800 rounded-xl p-2 w-56 shadow-2xl flex flex-col z-[100] animate-fade-in text-left">
                  <span className="text-[9px] uppercase tracking-widest text-neutral-500 p-2 block border-b border-neutral-900">Preset Templates</span>
                  <button onClick={() => { createNewProject("canvas", "canvas", 1400, 1400); setShowPresetDropdown(false); }} className="p-2 text-xs text-neutral-200 hover:bg-neutral-900 rounded text-left">Screen Square (1400 x 1400)</button>
                  <button onClick={() => { createNewProject("canvas", "canvas-a4", 2480, 3508); setShowPresetDropdown(false); }} className="p-2 text-xs text-neutral-200 hover:bg-neutral-900 rounded text-left">High-Res A4 (2480 x 3508)</button>
                  <button onClick={() => { createNewProject("apparel", "front-tshirt", 1200, 1200); setShowPresetDropdown(false); }} className="p-2 text-xs text-neutral-200 hover:bg-neutral-900 rounded text-left">T-Shirt Artboard (1200 x 1200)</button>
                  <button onClick={() => { createNewProject("apparel", "hat-blank", 1000, 1000); setShowPresetDropdown(false); }} className="p-2 text-xs text-[#007aff] hover:bg-neutral-900 rounded text-left">Cap/Hat Canvas (1000 x 1000)</button>
                </div>
              )}
            </div>
          </div>

          {/* Grid stack of gallery project cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {galleryProjects.map((p) => (
              <div 
                key={p.id} 
                onClick={() => loadProjectToEditor(p)}
                className="group flex flex-col cursor-pointer bg-[#1c1c1e] rounded-xl overflow-hidden border border-neutral-900 hover:border-indigo-500/50 hover:shadow-2xl transition-all p-3"
              >
                <div className="aspect-square bg-neutral-950 rounded-lg flex items-center justify-center overflow-hidden border border-neutral-900 relative">
                  {p.canvasKind === "canvas" ? (
                    <div className="w-4/5 h-4/5 bg-white rounded-md shadow-lg flex items-center justify-center">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Artboard</span>
                    </div>
                  ) : (
                    <div className="w-full h-full p-2 flex items-center justify-center relative bg-transparent">
                      <Shirt size={48} className="text-indigo-400/30" />
                    </div>
                  )}
                  <span className="absolute bottom-1 right-2 text-[8px] bg-black/60 px-1.5 py-0.5 rounded text-neutral-400 font-mono">
                    {p.artboardW}x{p.artboardH}
                  </span>
                </div>
                <div className="mt-3 flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-neutral-200 truncate max-w-[110px]">{p.projectName}</h3>
                    <p className="text-[9px] text-neutral-500 font-mono mt-0.5">{p.updatedAt}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGalleryProjects((prev) => prev.filter((x) => x.id !== p.id));
                    }}
                    className="p-1 text-neutral-600 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         THE ICONIC PROCREATE SYSTEM HEADER BAR (Completely Cleansed)
         ───────────────────────────────────────────────────────────── */}
      {currentView === "editor" && !fullScreenCanvas && (
        <div className={`flex items-center justify-between px-6 h-14 border-b shrink-0 z-50 transition-all ${isDark ? "bg-[#1c1c1e]/95 border-neutral-900" : "bg-white/95 border-neutral-200 shadow-sm"}`}>
          
          {/* Left Cluster: Gallery & Utilities */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentView("gallery")} 
              className="px-4 py-2 rounded-lg text-sm font-semibold tracking-wide text-indigo-500 hover:bg-indigo-500/10 transition-colors font-sans"
            >
              Gallery
            </button>
            
            <span className="w-px h-5 bg-neutral-300 dark:bg-neutral-850 mx-2" />

            {/* Actions (Wrench Popover) */}
            <button 
              onClick={() => togglePopover("actions")} 
              className={`p-2.5 rounded-lg transition-colors ${activePopover === "actions" ? "text-indigo-500 bg-indigo-500/10 shadow-sm" : "text-neutral-400 hover:text-[#1c1c1e] dark:hover:text-[#efeff1]"}`}
              title="Actions (Wrench)"
            >
              <Wrench size={18} />
            </button>

            {/* Adjustments (Wand Popover: AI & Filters) */}
            <button 
              onClick={() => togglePopover("adjustments")} 
              className={`p-2.5 rounded-lg transition-colors ${activePopover === "adjustments" ? "text-indigo-500 bg-indigo-500/10 shadow-sm" : "text-neutral-400 hover:text-[#1c1c1e] dark:hover:text-[#efeff1]"}`}
              title="Adjustments (Filters & AI)"
            >
              <Wand2 size={18} />
            </button>

            {/* Selection Lasso tool (marching ants ribbon) */}
            <button 
              onClick={() => { setTool("lasso"); setRegionMode(false); setSelectedId(null); }} 
              className={`p-2.5 rounded-lg transition-colors ${tool === "lasso" ? "text-indigo-500 bg-indigo-500/10 shadow-sm" : "text-neutral-400 hover:text-[#1c1c1e] dark:hover:text-[#efeff1]"}`}
              title="Selection Ribbon"
            >
              <SquareDashed size={18} />
            </button>

            {/* Transform selection arrow */}
            <button 
              onClick={() => { setTool("select"); setRegionMode(false); }} 
              className={`p-2.5 rounded-lg transition-colors ${tool === "select" && !regionMode ? "text-indigo-500 bg-indigo-500/10 shadow-sm" : "text-neutral-400 hover:text-[#1c1c1e] dark:hover:text-[#efeff1]"}`}
              title="Transform"
            >
              <MousePointer2 size={18} />
            </button>
          </div>

          <span className="hidden xl:inline text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 max-w-[150px] truncate">
            {projectName}
          </span>

          {/* Right Cluster: Artistic Tools, Layers, Colors */}
          <div className="flex items-center gap-1.5">
            {/* Paint brush */}
            <button 
              onClick={() => { setTool("brush"); setRegionMode(false); }} 
              className={`p-2 rounded-lg transition-all ${tool === "brush" ? "text-[#007aff] bg-[#007aff]/10" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-[#efeff1]"}`}
              title="Paint Tool"
            >
              <Paintbrush size={18} />
            </button>

            {/* Smudge tool */}
            <button 
              onClick={() => { setTool("smudge"); setRegionMode(false); }} 
              className={`p-2 rounded-lg transition-all ${tool === "smudge" ? "text-[#007aff] bg-[#007aff]/10" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-[#efeff1]"}`}
              title="Smudge Tool"
            >
              <Hand size={18} />
            </button>

            {/* Eraser */}
            <button 
              onClick={() => { setTool("eraser"); setRegionMode(false); }} 
              className={`p-2 rounded-lg transition-all ${tool === "eraser" ? "text-[#007aff] bg-[#007aff]/10" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-[#efeff1]"}`}
              title="Eraser Tool"
            >
              <Eraser size={18} />
            </button>

            {/* Paint Bucket fill */}
            <button 
              onClick={() => { setTool("fill"); setRegionMode(false); }} 
              className={`p-2 rounded-lg transition-all ${tool === "fill" ? "text-[#007aff] bg-[#007aff]/10" : "text-neutral-400 hover:text-neutral-100 dark:hover:text-[#efeff1]"}`}
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
      {currentView === "editor" && (
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
      )}

      {/* ─────────────────────────────────────────────────────────────
         CONTEXT-SENSITIVE HORIZONTAL TWEAK BAR (Always visible under header)
         ───────────────────────────────────────────────────────────── */}
      {currentView === "editor" && !fullScreenCanvas && (
        <div className={`px-6 py-2 border-b shrink-0 flex items-center justify-between gap-3 flex-wrap ${isDark ? "bg-[#18181b] border-neutral-900" : "bg-[#f4f5f7] border-neutral-200"}`}>
          
          {/* Brush/Eraser Settings */}
          {(tool === "brush" || tool === "eraser" || tool === "smudge") && (
            <div className="flex items-center gap-4 flex-wrap text-xs font-semibold animate-fade-in font-sans">
              <span className="text-[10px] opacity-50 uppercase tracking-widest animate-pulse text-indigo-500 font-bold">Brush active</span>
              {quickShapeHint && (
                <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  ⊹ {quickShapeHint} snapped
                </span>
              )}
              <div className="flex flex-wrap bg-neutral-200 dark:bg-neutral-800 p-0.5 rounded-full border border-neutral-350 dark:border-neutral-850 max-w-[420px]">
                {(["round", "pencil", "ink", "marker", "airbrush", "spray", "charcoal", "calligraphy", "watercolor", "textured"] as const).map((b) => (
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
            <input type="color" value={brushColor} onChange={(e) => setColorFromHex(e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer shrink-0" />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         THE SELECTIONS COMPACT CONTROL PANEL (Ribbon HUD Action Bar)
         ───────────────────────────────────────────────────────────── */}
      {currentView === "editor" && tool === "lasso" && !fullScreenCanvas && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-45 flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md shadow-xl border border-neutral-200/20 pointer-events-auto animate-fade-in">
          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 select-none">Selection Modes</span>
          <button 
            onClick={() => setSelectionModeType("freehand")} 
            className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-full transition-all ${selectionModeType === "freehand" ? "bg-[#007aff] text-white" : "text-[#8e8e93]"}`}
          >
            Freehand (Lasso)
          </button>
          <button 
            onClick={() => {
              setSelectionModeType("rectangle");
              setRegionMode(true);
            }} 
            className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-full transition-all ${selectionModeType === "rectangle" && regionMode ? "bg-[#007aff] text-white" : "text-[#8e8e93]"}`}
          >
            Rectangle
          </button>

          <span className="w-px h-5 bg-[#1c1c1e] dark:bg-neutral-800" />

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
      {currentView === "editor" && tool === "select" && selectedLayer && !fullScreenCanvas && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-45 flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md shadow-xl border border-neutral-200/20 pointer-events-auto animate-fade-in">
          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 select-none">Scale</span>
          <button 
            onClick={() => setUniformScaling(true)} 
            className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-full transition-all ${uniformScaling ? "bg-[#007aff] text-white" : "text-[#8e8e93]"}`}
          >
            Uniform
          </button>
          <button 
            onClick={() => setUniformScaling(false)} 
            className={`px-3 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-full transition-all ${!uniformScaling ? "bg-[#007aff] text-white" : "text-[#8e8e93]"}`}
          >
            Freeform
          </button>

          <span className="w-px h-5 bg-[#1c1c1e] dark:bg-neutral-800" />

          <button onClick={() => { patchLayer(selectedLayer.id, { rotation: (selectedLayer.rotation + 45) % 360 }); }} className="p-1 hover:bg-[#1c1c1e] dark:hover:bg-neutral-850 rounded text-neutral-400"><RefreshCcw size={13} /></button>
          <button onClick={() => { const sx = nodeRefs.current[selectedLayer.id]?.scaleX() || 1; patchLayer(selectedLayer.id, { x: selectedLayer.x + selectedLayer.width! * sx, width: selectedLayer.width, scaleX: -sx }); }} className="p-1 hover:bg-[#1c1c1e] dark:hover:bg-[#09090b] rounded text-neutral-400"><FlipHorizontal2 size={13} /></button>
          <button onClick={() => { const sy = nodeRefs.current[selectedLayer.id]?.scaleY() || 1; patchLayer(selectedLayer.id, { y: selectedLayer.y + selectedLayer.height! * sy, height: selectedLayer.height, scaleY: -sy }); }} className="p-1 hover:bg-[#1c1c1e] dark:hover:bg-[#09090b] rounded text-neutral-400"><FlipVertical2 size={13} /></button>
          
          <span className="w-px h-5 bg-[#1c1c1e] dark:bg-neutral-850" />

          <button onClick={() => { patchLayer(selectedLayer.id, { x: 0, y: 0, width: artboardW, height: artboardH }); }} className="text-[9px] font-bold text-indigo-500 hover:underline uppercase">Fit to canvas</button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
         THE ICONIC FLOATING POP-OVER DROPDOWNS (Wrench / Wand / Layers / Colors)
         ───────────────────────────────────────────────────────────── */}
      {currentView === "editor" && activePopover !== "none" && !fullScreenCanvas && (
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
                <div className="flex border-b border-neutral-200 dark:border-[#1c1c1e] pb-2 mb-2">
                  {["add", "canvas", "share", "prefs"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActivePopoverTab(tab)}
                      className={`flex-1 text-center py-1 text-xs font-bold uppercase tracking-wider transition-all ${
                        activePopoverTab === tab 
                          ? "text-[#007aff] bg-[#007aff]/10 rounded-full" 
                          : "text-[#8e8e93] hover:text-[#007aff]"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* ADD TAB */}
                {activePopoverTab === "add" && (
                  <div className="space-y-3 animate-fade-in font-mono">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">Insert Elements</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { addText(); setActivePopover("none"); }} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed text-neutral-500 hover:text-[#007aff] hover:border-[#007aff]/40 transition-colors">
                        <Type size={18} /> <span className="text-[10px] font-bold uppercase font-sans">Insert Text</span>
                      </button>
                      <label className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed text-neutral-500 hover:text-[#007aff] hover:border-[#007aff]/40 transition-colors cursor-pointer">
                        <ImagePlus size={18} /> <span className="text-[10px] font-bold uppercase font-sans">Insert Photo</span>
                        <input type="file" accept="image/*,.svg,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { uploadImage(e.target.files[0]); setActivePopover("none"); } }} />
                      </label>
                    </div>
                    <label className="w-full flex items-center justify-center gap-2 py-3 border border-dashed rounded-xl cursor-pointer text-neutral-500 hover:text-[#007aff] hover:border-[#007aff]/40 text-xs font-bold transition-all font-sans">
                      <Wand2 size={14} /> Import Texture Overlay
                      <input type="file" accept="image/*,.svg,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { importTexture(e.target.files[0]); setActivePopover("none"); } }} />
                    </label>
                  </div>
                )}

                {/* CANVAS TAB */}
                {activePopoverTab === "canvas" && (
                  <div className="space-y-3 animate-fade-in">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93] font-mono">Sandbox Actions</p>
                    <button onClick={() => { open3d(); setActivePopover("none"); }} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border border-[#1c1c1e] dark:border-neutral-850">
                      <span className="flex items-center gap-2.5"><Box size={14} /> 3D Garment Sandbox</span>
                      <span className="text-[8px] bg-indigo-50/15 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase">3D</span>
                    </button>
                    {product?.mfr === "printful" && (
                      <button onClick={() => { setEdmOpen(true); setActivePopover("none"); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                        <Wand2 size={14} /> Printful Creator Suite
                      </button>
                    )}
                    <span className="block h-px bg-neutral-200 dark:bg-neutral-850" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-60 font-semibold text-neutral-400">Active Symmetry Guide</span>
                      <button onClick={() => setSymmetry((s) => (s === "off" ? "v" : s === "v" ? "h" : "off"))} className="font-bold text-[#007aff] hover:underline uppercase text-[11px] font-mono">
                        {symmetry === "off" ? "Disabled" : symmetry === "v" ? "Vertical" : "Horizontal"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-60 font-semibold text-neutral-400">Drawing Grid</span>
                      <button onClick={() => setShowGrid((g) => !g)} className={`font-bold hover:underline uppercase text-[11px] font-mono ${showGrid ? "text-[#007aff]" : "text-neutral-400"}`}>
                        {showGrid ? "On" : "Off"}
                      </button>
                    </div>
                    {showGrid && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="opacity-60 font-semibold text-neutral-400">Grid Size</span>
                        <input type="range" min={20} max={400} step={20} value={gridSize} onChange={(e) => setGridSize(parseInt(e.target.value))} className="w-24 accent-[#007aff]" />
                      </div>
                    )}
                  </div>
                )}

                {/* SHARE TAB */}
                {activePopoverTab === "share" && (
                  <div className="space-y-3 animate-fade-in font-sans">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">Export Options</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={exportPng} className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold border border-[#1c1c1e] dark:border-neutral-700 hover:bg-[#1c1c1e] dark:hover:bg-[#09090b]">
                        <Download size={13} /> Export PNG
                      </button>
                      <button onClick={save} disabled={saving} className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold border border-[#1c1c1e] dark:border-neutral-700 hover:bg-[#1c1c1e] dark:hover:bg-[#09090b]">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save State
                      </button>
                    </div>
                    <button onClick={publish} disabled={publishing} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase bg-[#007aff] text-white hover:bg-[#005bb5]">
                      {publishing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Publish Design
                    </button>
                  </div>
                )}

                {/* PREFS TAB */}
                {activePopoverTab === "prefs" && (
                  <div className="space-y-4 animate-fade-in text-xs font-semibold text-neutral-400 font-sans">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">Interface Appearance</p>
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
                    
                    <span className="block h-px bg-[#1c1c1e] dark:bg-neutral-850" />

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
                      <button onClick={() => { setMatchOpen(true); setActivePopover("none"); }} className="w-full py-2 bg-indigo-500/10 hover:bg-[#1c1c1e] text-[#007aff] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider border border-indigo-500/20 font-mono">
                        <Shirt size={13} /> Open Store Blank Matcher
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Adjustments Popover — Procreate-complete: Hue/Sat/Bri/Contrast, Blur, Opacity, AI */}
            {activePopover === "adjustments" && (
              <div className="space-y-4 font-sans">
                <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">Adjustments</p>

                {/* ── Layer colour adjustments ── */}
                {selectedLayer ? (
                  <div className="space-y-3.5">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{selectedLayer.name}</p>

                    {selectedLayer.type === "paint" && (
                      <>
                        {/* Hue */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-neutral-400">
                            <span>Hue</span><span className="font-mono">{adjHue > 0 ? "+" : ""}{adjHue}°</span>
                          </div>
                          <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}>
                            <input type="range" min={-180} max={180} value={adjHue} className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" onChange={(e) => setAdjHue(parseInt(e.target.value))} />
                            <div className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-white border border-neutral-600 shadow pointer-events-none" style={{ left: `${((adjHue + 180) / 360) * 100}%` }} />
                          </div>
                        </div>
                        {/* Saturation */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-neutral-400">
                            <span>Saturation</span><span className="font-mono">{adjSat}%</span>
                          </div>
                          <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, #808080, hsl(${colorH},100%,50%))` }}>
                            <input type="range" min={0} max={200} value={adjSat} className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" onChange={(e) => setAdjSat(parseInt(e.target.value))} />
                            <div className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-white border border-neutral-600 shadow pointer-events-none" style={{ left: `${(adjSat / 200) * 100}%` }} />
                          </div>
                        </div>
                        {/* Brightness */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-neutral-400">
                            <span>Brightness</span><span className="font-mono">{adjBri}%</span>
                          </div>
                          <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #000, #fff)" }}>
                            <input type="range" min={0} max={200} value={adjBri} className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" onChange={(e) => setAdjBri(parseInt(e.target.value))} />
                            <div className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-white border border-neutral-600 shadow pointer-events-none" style={{ left: `${(adjBri / 200) * 100}%` }} />
                          </div>
                        </div>
                        {/* Contrast */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-neutral-400">
                            <span>Contrast</span><span className="font-mono">{adjContrast > 0 ? "+" : ""}{adjContrast}</span>
                          </div>
                          <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #666, #fff)" }}>
                            <input type="range" min={-128} max={128} value={adjContrast} className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" onChange={(e) => setAdjContrast(parseInt(e.target.value))} />
                            <div className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-white border border-neutral-600 shadow pointer-events-none" style={{ left: `${((adjContrast + 128) / 256) * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={applyAdjustments} className="flex-1 py-2 rounded-xl bg-[#007aff] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#005bb5] transition-colors">
                            Apply
                          </button>
                          <button onClick={() => { setAdjHue(0); setAdjSat(100); setAdjBri(100); setAdjContrast(0); }} className="px-4 py-2 rounded-xl border border-neutral-700 text-[10px] font-bold text-neutral-400 hover:text-neutral-200 transition-colors">
                            Reset
                          </button>
                        </div>
                      </>
                    )}

                    {/* Blur (all layer types) */}
                    <div className="space-y-1 pt-1 border-t border-neutral-800">
                      <div className="flex justify-between text-[10px] font-semibold text-neutral-400">
                        <span>Gaussian Blur</span><span>{selectedLayer.blur || 0}px</span>
                      </div>
                      <input type="range" min={0} max={100} value={selectedLayer.blur || 0}
                        onMouseDown={() => recordLayers(layers)}
                        onChange={(e) => livePatch(selectedLayer.id, { blur: parseInt(e.target.value) })}
                        className="w-full accent-[#007aff]" />
                    </div>

                    {/* Opacity */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-neutral-400">
                        <span>Layer Opacity</span><span>{Math.round(selectedLayer.opacity * 100)}%</span>
                      </div>
                      <input type="range" min={0} max={100} value={Math.round(selectedLayer.opacity * 100)}
                        onMouseDown={() => recordLayers(layers)}
                        onChange={(e) => livePatch(selectedLayer.id, { opacity: parseInt(e.target.value) / 100 })}
                        className="w-full accent-[#007aff]" />
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] opacity-40 py-2">Select a layer to adjust.</p>
                )}

                <span className="block h-px bg-neutral-800" />

                {/* ── AI Generation Suite ── */}
                <div className="space-y-3">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">AI Generative Suite</p>
                  <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe design, or draw a lasso then generate into it…"
                    className="w-full h-14 bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-200 font-mono resize-none" />
                  {lassoPoints.length >= 3 ? (
                    <button onClick={handleLassoRegionAi} disabled={aiBusy} className="w-full py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500 text-white hover:bg-indigo-600 flex items-center justify-center gap-1">
                      {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate Into Lasso
                    </button>
                  ) : (
                    <button onClick={aiNewLayer} disabled={aiBusy} className="w-full py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500 text-white hover:bg-indigo-600 flex items-center justify-center gap-1">
                      {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate New Layer
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* LAYERS POPOVER */}
            {activePopover === "layers" && (
              <div className="space-y-4 font-sans">
                <div className="flex justify-between items-center border-b border-[#1c1c1e] dark:border-neutral-850 pb-2">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">Layers stack</p>
                  <button onClick={addPaintLayer} className="text-xs font-bold text-indigo-500 hover:underline flex items-center gap-1 font-sans">
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
                          : "border-transparent hover:bg-neutral-150 dark:hover:bg-[#1a1a1c]"
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
                        
                        <span className="text-[10px] font-bold bg-[#1c1c1e] dark:bg-neutral-850 px-2 py-0.5 rounded-full text-neutral-400 font-mono">
                          {BLEND_ABBR[l.blend || "source-over"]}
                        </span>
                      </div>

                      {/* Sliding Actions Flyout */}
                      {activeLayerSettingsId === l.id && selectedId === l.id && (
                        <div className="mt-2.5 pt-2 border-t border-[#1c1c1e] dark:border-neutral-800 space-y-2 text-[10px] text-neutral-500 animate-fade-in font-mono">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-400">Align Elements</span>
                            <div className="flex gap-1">
                              <button onClick={(e) => { e.stopPropagation(); align("h"); }} className="p-1 hover:bg-[#1c1c1e] dark:hover:bg-[#1a1a1c] rounded"><AlignCenterVertical size={11} /></button>
                              <button onClick={(e) => { e.stopPropagation(); align("v"); }} className="p-1 hover:bg-[#1c1c1e] dark:hover:bg-[#1a1a1c] rounded"><AlignCenterHorizontal size={11} /></button>
                              <button onClick={(e) => { e.stopPropagation(); align("both"); }} className="p-1 hover:bg-[#1c1c1e] dark:hover:bg-[#1a1a1c] rounded"><AlignVerticalJustifyCenter size={11} /></button>
                            </div>
                          </div>
                          <span className="block h-px bg-[#1c1c1e] dark:bg-neutral-850" />
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
                            <div className="space-y-1.5 mt-1 pt-1 border-t border-[#1c1c1e] dark:border-neutral-800">
                              <input value={l.text} onChange={(e) => patchLayer(l.id, { text: e.target.value })} className="w-full text-[10px] bg-transparent border rounded p-1 text-neutral-200 border-neutral-850 font-sans" />
                              <div className="flex justify-between items-center font-sans">
                                <input type="color" value={l.fill} onChange={(e) => patchLayer(l.id, { fill: e.target.value })} className="w-5 h-5 rounded cursor-pointer" />
                                <input type="number" value={Math.round(l.fontSize || 0)} onChange={(e) => patchLayer(l.id, { fontSize: parseInt(e.target.value) || 48 })} className="w-12 bg-transparent border rounded text-center text-neutral-200 border-neutral-850" />
                              </div>
                            </div>
                          )}

                          <span className="block h-px bg-[#1c1c1e] dark:bg-neutral-850" />

                          <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider gap-3 font-sans">
                            <button onClick={(e) => { e.stopPropagation(); move(l.id, 1); }} className="hover:text-indigo-400">Up</button>
                            <button onClick={(e) => { e.stopPropagation(); move(l.id, -1); }} className="hover:text-indigo-400">Down</button>
                            <button onClick={(e) => { e.stopPropagation(); const copy = { ...l, id: uid(), name: l.name + " Copy", x: l.x + 16, y: l.y + 16 }; commit((ls) => [...ls, copy]); setSelectedId(copy.id); }} className="hover:text-indigo-400">Duplicate</button>
                            <button onClick={(e) => { e.stopPropagation(); handleMergeDown(l.id); }} className="hover:text-indigo-400">Merge↓</button>
                            <button onClick={(e) => { e.stopPropagation(); commit((ls) => ls.filter((x) => x.id !== l.id)); setSelectedId(null); }} className="text-rose-500">Delete</button>
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
                <div className="flex border-b border-[#1c1c1e] dark:border-neutral-850 pb-2 mb-2 text-[10px] font-bold uppercase tracking-wider">
                  {["disc", "classic", "palette", "history"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setColorSelectorTab(t as any)}
                      className={`flex-1 text-center py-1 transition-all ${
                        colorSelectorTab === t 
                          ? "text-[#007aff] border-[#007aff]" 
                          : "text-[#8e8e93] hover:text-[#007aff]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* COLOR DISC TAB — outer hue ring + inner SB square */}
                {colorSelectorTab === "disc" && (
                  <div className="space-y-3 animate-fade-in flex flex-col items-center font-mono">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">Colour Disc</p>
                    {/* Outer hue ring */}
                    <div className="relative select-none" style={{ width: 176, height: 176 }}>
                      {/* Hue ring — clickable */}
                      <div
                        className="absolute inset-0 rounded-full cursor-crosshair"
                        style={{ background: "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
                        onPointerDown={(e) => {
                          const el = e.currentTarget;
                          const handleMove = (ev: PointerEvent) => {
                            const rect = el.getBoundingClientRect();
                            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
                            const dx = ev.clientX - cx, dy = ev.clientY - cy;
                            const r = Math.sqrt(dx * dx + dy * dy);
                            const outerR = rect.width / 2, innerR = outerR * 0.62;
                            if (r < innerR || r > outerR) return;
                            let deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                            setColorFromHsb(Math.round(deg), colorS, colorB);
                          };
                          const up = () => { window.removeEventListener("pointermove", handleMove as any); window.removeEventListener("pointerup", up); };
                          handleMove(e.nativeEvent as PointerEvent);
                          window.addEventListener("pointermove", handleMove as any);
                          window.addEventListener("pointerup", up);
                          e.preventDefault();
                        }}
                      />
                      {/* Inner circle mask */}
                      <div className="absolute rounded-full pointer-events-none" style={{ inset: "19%", background: isDark ? "#09090b" : "#f4f5f7" }} />
                      {/* Saturation/Brightness square inside */}
                      <div
                        className="absolute cursor-crosshair rounded-sm overflow-hidden"
                        style={{ inset: "22%", background: `linear-gradient(to right, #fff, hsl(${colorH},100%,50%))` }}
                        onPointerDown={(e) => {
                          const el = e.currentTarget;
                          const handleMove = (ev: PointerEvent) => {
                            const rect = el.getBoundingClientRect();
                            const sx = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                            const sy = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
                            setColorFromHsb(colorH, Math.round(sx * 100), Math.round((1 - sy) * 100));
                          };
                          const up = () => { window.removeEventListener("pointermove", handleMove as any); window.removeEventListener("pointerup", up); };
                          handleMove(e.nativeEvent as PointerEvent);
                          window.addEventListener("pointermove", handleMove as any);
                          window.addEventListener("pointerup", up);
                          e.preventDefault();
                        }}
                      >
                        {/* Brightness overlay: white→black top→bottom */}
                        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #000)" }} />
                        {/* Cursor dot */}
                        <div className="absolute w-3 h-3 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ left: `${colorS}%`, top: `${100 - colorB}%`, backgroundColor: brushColor }} />
                      </div>
                    </div>
                    {/* Hex input */}
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-8 h-8 rounded-lg border border-neutral-700 shrink-0" style={{ backgroundColor: brushColor }} />
                      <input
                        type="text"
                        value={brushColor}
                        onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{6}$/.test(v)) setColorFromHex(v); }}
                        className="flex-1 bg-neutral-900 text-neutral-200 text-xs font-mono rounded-lg px-2 py-1.5 border border-neutral-700 outline-none focus:border-[#007aff]"
                        maxLength={7}
                      />
                    </div>
                  </div>
                )}

                {/* CLASSIC HSB SLIDERS TAB */}
                {colorSelectorTab === "classic" && (
                  <div className="space-y-4 animate-fade-in font-sans">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">HSB Sliders</p>
                    <div className="space-y-3 text-[11px] font-semibold text-neutral-400 font-sans">
                      {/* Hue */}
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Hue</span><span className="font-mono text-neutral-300">{colorH}°</span></div>
                        <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}>
                          <input type="range" min={0} max={360} value={colorH} className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" onChange={(e) => setColorFromHsb(parseInt(e.target.value), colorS, colorB)} />
                          <div className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-white border border-neutral-700 shadow" style={{ left: `${(colorH / 360) * 100}%`, pointerEvents: "none" }} />
                        </div>
                      </div>
                      {/* Saturation */}
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Saturation</span><span className="font-mono text-neutral-300">{colorS}%</span></div>
                        <div className="relative h-3 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, #888, hsl(${colorH},100%,50%))` }}>
                          <input type="range" min={0} max={100} value={colorS} className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" onChange={(e) => setColorFromHsb(colorH, parseInt(e.target.value), colorB)} />
                          <div className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-white border border-neutral-700 shadow" style={{ left: `${colorS}%`, pointerEvents: "none" }} />
                        </div>
                      </div>
                      {/* Brightness */}
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Brightness</span><span className="font-mono text-neutral-300">{colorB}%</span></div>
                        <div className="relative h-3 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, #000, hsl(${colorH},${colorS}%,50%))` }}>
                          <input type="range" min={0} max={100} value={colorB} className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" onChange={(e) => setColorFromHsb(colorH, colorS, parseInt(e.target.value))} />
                          <div className="absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full bg-white border border-neutral-700 shadow" style={{ left: `${colorB}%`, pointerEvents: "none" }} />
                        </div>
                      </div>
                      {/* Hex input */}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded border border-neutral-700 shrink-0" style={{ backgroundColor: brushColor }} />
                        <input
                          type="text" value={brushColor} maxLength={7}
                          onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{6}$/.test(v)) setColorFromHex(v); }}
                          className="flex-1 bg-neutral-900 text-neutral-200 text-xs font-mono rounded px-2 py-1 border border-neutral-700 outline-none focus:border-[#007aff]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* PALETTES TAB */}
                {colorSelectorTab === "palette" && (
                  <div className="space-y-3 animate-fade-in">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93] font-sans">Colour Palette</p>
                    {/* Harmony mode pills */}
                    <div className="flex flex-wrap gap-1">
                      {([["none","Off"],["comp","Comp"],["split","Split"],["triadic","Triadic"],["tetradic","Tetra"],["analogous","Analog"]] as const).map(([m,l]) => (
                        <button key={m} onClick={() => setHarmonyMode(m as any)}
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider transition-colors border ${harmonyMode === m ? "bg-[#007aff] text-white border-[#007aff]" : "text-neutral-400 border-neutral-700 hover:border-neutral-500"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {["#1c1c1e", "#3a3a3c", "#5c5c5e", "#aeaeaf", "#e5e5ea", "#ffffff", "#ff3b30", "#ff9500", "#ffcc00", "#4cd964", "#5ac8fa", "#007aff", "#5856d6", "#af52de", "#ff2d55", "#a2845e", "#34aadc", "#4cd964"].map((c) => (
                        <button key={c} onClick={() => setColorFromHex(c)} className="w-8 h-8 rounded border border-[#1c1c1e] dark:border-neutral-850 transition-transform active:scale-90" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* HARMONY TAB */}
                {colorSelectorTab === "palette" && harmonyMode !== "none" && harmonyColors.length > 0 && (
                  <div className="space-y-2 border-t border-neutral-800 pt-3 animate-fade-in">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">Harmony — {harmonyMode}</p>
                    <div className="flex gap-2 items-center">
                      <div className="w-7 h-7 rounded-lg border border-neutral-700 shrink-0 ring-2 ring-white/20" style={{ backgroundColor: brushColor }} />
                      {harmonyColors.map((c, i) => (
                        <button key={i} onClick={() => setColorFromHex(c)} className="w-7 h-7 rounded-lg border border-neutral-700 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* HISTORY PANEL TAB */}
                {colorSelectorTab === "history" && (
                  <div className="space-y-3 animate-fade-in font-sans">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#8e8e93]">Sampled History</p>
                    <div className="grid grid-cols-6 gap-2">
                      {colorHistory.map((c, i) => (
                        <button key={c + i} onClick={() => setColorFromHex(c)} className="w-8 h-8 rounded-full border border-[#1c1c1e] dark:border-[#1c1c1e] transition-transform active:scale-90" style={{ backgroundColor: c }} />
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
         MAIN DIGITAL ARTWORK VIEWPORT (Centred & Formatted Container)
         ───────────────────────────────────────────────────────────── */}
      {currentView === "editor" && (
        <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black select-none h-full w-full">
          <div 
            ref={scrollOuterRef} 
            className="w-full h-full flex items-center justify-center overflow-hidden relative canvas-scroll-container"
            style={{ touchAction: 'none' }}
          >
            {/* Real centering elements mapping to templates */}
            <div 
              className={`transition-transform duration-75 flex items-center justify-center ${
                isTemplateProject ? "" : "rounded-[24px] shadow-2xl border border-neutral-850"
              }`}
              style={{
                width: `${artboardW * scale}px`,
                height: `${artboardH * scale}px`,
                transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`,
                backgroundColor: isTemplateProject ? "transparent" : "#ffffff"
              }}
            >
              <Stage
                ref={stageRef}
                width={artboardW * scale} height={artboardH * scale} scaleX={scale} scaleY={scale}
                style={{ cursor: tool === "brush" ? "crosshair" : tool === "eraser" ? "cell" : tool === "lasso" ? "crosshair" : "default" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
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
                      <Rect name="bg" x={0} y={0} width={artboardW} height={artboardH} fill={isTemplateProject ? "rgba(0,0,0,0)" : "#ffffff"} listening />
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

                    {/* Design artwork group — exported on its own (transparent, no
                        garment photo) for accurate 3D projection. */}
                    <Group ref={designGroupRef} name="design-group">
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
                    </Group>

                    {(tool === "brush" || tool === "eraser" || tool === "smudge") && symmetry === "v" && <Rect name="symmetry-guide" x={artboardW / 2 - 1} y={0} width={2} height={artboardH} fill="#6366f1" opacity={0.5} listening={false} />}
                    {(tool === "brush" || tool === "eraser" || tool === "smudge") && symmetry === "h" && <Rect name="symmetry-guide" x={0} y={artboardH / 2 - 1} width={artboardW} height={2} fill="#6366f1" opacity={0.5} listening={false} />}

                    {/* Drawing grid overlay */}
                    {showGrid && (
                      <>
                        {Array.from({ length: Math.floor(artboardW / gridSize) - 1 }, (_, i) => (
                          <Rect key={`gv${i}`} x={(i + 1) * gridSize} y={0} width={1} height={artboardH} fill={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"} listening={false} />
                        ))}
                        {Array.from({ length: Math.floor(artboardH / gridSize) - 1 }, (_, i) => (
                          <Rect key={`gh${i}`} x={0} y={(i + 1) * gridSize} width={artboardW} height={1} fill={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"} listening={false} />
                        ))}
                      </>
                    )}

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
      )}

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
      {currentView === "editor" && (
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
                  className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${activeP === i ? "bg-indigo-50/20 text-indigo-400 border border-indigo-500/30" : "text-neutral-500"}`}
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
      )}

      {/* ─────────────────────────────────────────────────────────────
         MODALS & PORTALS (Attach Blanks / 3D previews / Printful Maker)
         ───────────────────────────────────────────────────────────── */}
      {matchOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setMatchOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-[24px] border p-6 ${isDark ? "bg-[#1c1c1e] border-neutral-800 text-neutral-100" : "bg-white border-neutral-200 text-[#1c1c1e]"}`}>
            <h2 className="text-[13px] font-semibold mb-1 font-sans">Match to a real blank</h2>
            <p className="text-[10px] mb-4 text-[#8e8e93] font-sans">Pick a garment category to fetch and match cheapest options.</p>
            <div className="flex items-center gap-2 mb-4">
              <select value={matchType} onChange={(e) => setMatchType(e.target.value)}
                className={`flex-1 text-[11px] rounded-full px-3 py-2 border focus:outline-none ${isDark ? "bg-[#09090b] border-neutral-850 text-neutral-200" : "bg-white border-neutral-200"}`}>
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
            fetchMockups={fetchMockups}
            productColor={product?.color ?? null}
            garmentType={(() => {
              const k = `${templateKey || ""} ${(product as any)?.type || ""}`.toLowerCase();
              if (/hat|cap|beanie|trucker/.test(k)) return "hat";
              if (/poster|canvas|print|frame|wall/.test(k)) return "poster";
              if (/tote|bag/.test(k)) return "tote";
              if (/mug|bottle|tumbler/.test(k)) return "mug";
              if (/hoodie|sweat|crewneck/.test(k)) return "hoodie";
              return "apparel";
            })()}
            designAspect={(pa.w * artboardW) / (pa.h * artboardH)}
            liveCanvas={designCanvasRef.current} />
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

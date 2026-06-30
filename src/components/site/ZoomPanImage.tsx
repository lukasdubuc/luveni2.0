// ─────────────────────────────────────────────────────────────
//  Luveni — dynamic pan-and-zoom image canvas (Tamed Psychotic style)
//  High-magnification inspection: wheel / pinch to zoom toward the
//  cursor, drag to pan, double-tap/click to toggle 1x↔2.5x. Pointer
//  Events unify mouse + touch + pen. GPU-composited CSS transform.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";

const MIN = 1;
const MAX = 5;

interface XY { x: number; y: number }

export function ZoomPanImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<XY>({ x: 0, y: 0 });
  const drag = useRef<{ active: boolean; start: XY; origin: XY }>({
    active: false, start: { x: 0, y: 0 }, origin: { x: 0, y: 0 },
  });
  // Active pointers for pinch-zoom.
  const pointers = useRef<Map<number, XY>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);

  const clamp = (s: number) => Math.min(MAX, Math.max(MIN, s));

  // Keep the image from being panned entirely out of view.
  const clampOffset = useCallback((o: XY, s: number): XY => {
    const el = containerRef.current;
    if (!el) return o;
    const maxX = ((s - 1) * el.clientWidth) / 2;
    const maxY = ((s - 1) * el.clientHeight) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) };
  }, []);

  // Reset when the source changes (variant switch / new image).
  useEffect(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, [src]);

  const zoomToward = useCallback((clientX: number, clientY: number, nextScale: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    setScale((prev) => {
      const s = clamp(nextScale);
      const ratio = s / prev;
      setOffset((o) => clampOffset({ x: cx - (cx - o.x) * ratio, y: cy - (cy - o.y) * ratio }, s));
      return s;
    });
  }, [clampOffset]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoomToward(e.clientX, e.clientY, scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, [scale, zoomToward]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
    } else {
      drag.current = { active: true, start: { x: e.clientX, y: e.clientY }, origin: offset };
    }
  }, [offset, scale]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomToward(mid.x, mid.y, pinchStart.current.scale * (dist / pinchStart.current.dist));
      return;
    }
    if (drag.current.active && scale > 1) {
      const dx = e.clientX - drag.current.start.x;
      const dy = e.clientY - drag.current.start.y;
      setOffset(clampOffset({ x: drag.current.origin.x + dx, y: drag.current.origin.y + dy }, scale));
    }
  }, [scale, zoomToward, clampOffset]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) drag.current.active = false;
  }, []);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    if (scale > 1) { setScale(1); setOffset({ x: 0, y: 0 }); }
    else zoomToward(e.clientX, e.clientY, 2.5);
  }, [scale, zoomToward]);

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none absolute left-1/2 top-1/2 max-h-full max-w-full object-contain"
        style={{
          transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: drag.current.active ? "none" : "transform 120ms ease-out",
          willChange: "transform",
        }}
      />
      {scale > 1 && (
        <button
          onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white backdrop-blur"
        >
          Reset {scale.toFixed(1)}×
        </button>
      )}
    </div>
  );
}

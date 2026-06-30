// ─────────────────────────────────────────────────────────────
//  Luveni Studio — Procreate gesture controller
//  Two-finger tap → undo, three-finger tap → redo, plus pinch scale.
//  A "tap" = N fingers down and lifted within TAP_MS with little travel,
//  so it never fires during a real pan/zoom. Returns handlers to spread
//  on the canvas wrapper.
// ─────────────────────────────────────────────────────────────

import { useCallback, useRef } from "react";

const TAP_MS = 300;
const TAP_TRAVEL = 14; // px max movement to still count as a tap

export interface GestureHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export interface StudioGestureCallbacks {
  onUndo: () => void;
  onRedo: () => void;
  onPinch?: (scale: number) => void;
}

export function useStudioGestures(cb: StudioGestureCallbacks): GestureHandlers {
  const startTime = useRef(0);
  const maxFingers = useRef(0);
  const startCentroid = useRef({ x: 0, y: 0 });
  const travel = useRef(0);
  const pinchStartDist = useRef(0);

  const centroid = (touches: React.TouchList) => {
    let x = 0, y = 0;
    for (let i = 0; i < touches.length; i++) { x += touches[i].clientX; y += touches[i].clientY; }
    return { x: x / touches.length, y: y / touches.length };
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startTime.current = Date.now();
      maxFingers.current = 1;
      startCentroid.current = centroid(e.touches);
      travel.current = 0;
    } else {
      maxFingers.current = Math.max(maxFingers.current, e.touches.length);
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        pinchStartDist.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      }
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const c = centroid(e.touches);
    travel.current = Math.max(travel.current, Math.hypot(c.x - startCentroid.current.x, c.y - startCentroid.current.y));
    if (e.touches.length === 2 && cb.onPinch && pinchStartDist.current > 0) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      cb.onPinch(dist / pinchStartDist.current);
    }
  }, [cb]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    // Fires as fingers lift; act only when the last finger leaves.
    if (e.touches.length > 0) return;
    const quick = Date.now() - startTime.current <= TAP_MS;
    const still = travel.current <= TAP_TRAVEL;
    if (quick && still) {
      if (maxFingers.current === 2) cb.onUndo();
      else if (maxFingers.current >= 3) cb.onRedo();
    }
    maxFingers.current = 0;
    pinchStartDist.current = 0;
  }, [cb]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

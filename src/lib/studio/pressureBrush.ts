// ─────────────────────────────────────────────────────────────
//  Luveni Studio — pressure-sensitive brush engine (Procreate-style)
//  Pure stroke maths: maps PointerEvent pressure/velocity to a tapered,
//  interpolated variable-width stroke. Framework-agnostic so it can feed
//  Konva, a 2D canvas, or the WebGL layer. No imports → unit-testable.
// ─────────────────────────────────────────────────────────────

export interface BrushSettings {
  /** Max brush diameter in px (the size slider). */
  size: number;
  /** 0–1 master opacity (the opacity slider). */
  opacity: number;
  /** 0–1 how strongly pen pressure scales width (0 = constant width). */
  pressureWidth: number;
  /** 0–1 how strongly pen pressure scales opacity. */
  pressureOpacity: number;
  /** 0–1 edge softness for the stamp. */
  hardness: number;
  /** Stamp spacing as a fraction of width (lower = smoother, denser). */
  spacing: number;
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 24, opacity: 1, pressureWidth: 0.85, pressureOpacity: 0.4, hardness: 0.8, spacing: 0.12,
};

export interface InputSample {
  x: number; y: number;
  /** 0–1. Mice report 0/0.5; we floor to a sane default in that case. */
  pressure: number;
  /** ms timestamp for velocity-based dynamics. */
  t: number;
}

export interface StrokeStamp {
  x: number; y: number;
  width: number;   // px diameter at this stamp
  opacity: number; // 0–1 at this stamp
}

/** Normalize a raw PointerEvent into an InputSample. */
export function sampleFromPointer(e: PointerEvent, rect: { left: number; top: number }): InputSample {
  // Mice/trackpads report pressure 0 (up) or 0.5 (down). Treat as full.
  const isPen = e.pointerType === "pen";
  const pressure = isPen ? clamp01(e.pressure) : (e.pressure > 0 ? 0.5 : 0) > 0 ? 1 : 1;
  return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: isPen ? pressure : 1, t: e.timeStamp };
}

function clamp01(n: number): number { return Math.min(1, Math.max(0, n)); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/** Width (px) for a sample given brush + velocity (faster = thinner). */
export function widthFor(b: BrushSettings, pressure: number, velocity: number): number {
  const p = clamp01(pressure);
  const pressureFactor = lerp(1, p, b.pressureWidth);
  // Velocity taper: above ~3 px/ms the stroke thins toward 55%.
  const velFactor = lerp(1, 0.55, clamp01(velocity / 3) * 0.6);
  return Math.max(0.5, b.size * pressureFactor * velFactor);
}

/** Opacity for a sample given brush + pressure. */
export function opacityFor(b: BrushSettings, pressure: number): number {
  return clamp01(b.opacity * lerp(1, clamp01(pressure), b.pressureOpacity));
}

/**
 * Interpolate a path of samples into evenly-spaced stamps so strokes are
 * smooth at any input rate. Catmull-Rom-ish: we walk segment by segment
 * placing stamps every `spacing * width` px, lerping pressure between
 * endpoints. Returns the stamps plus the leftover distance carry so the
 * caller can stream samples without gaps.
 */
export function buildStamps(
  b: BrushSettings,
  samples: InputSample[],
  carry = 0,
): { stamps: StrokeStamp[]; carry: number } {
  const stamps: StrokeStamp[] = [];
  if (samples.length === 0) return { stamps, carry };
  if (samples.length === 1) {
    const s = samples[0];
    stamps.push({ x: s.x, y: s.y, width: widthFor(b, s.pressure, 0), opacity: opacityFor(b, s.pressure) });
    return { stamps, carry: 0 };
  }

  let leftover = carry;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], c = samples[i];
    const dx = c.x - a.x, dy = c.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen === 0) continue;
    const dt = Math.max(1, c.t - a.t);
    const velocity = segLen / dt; // px/ms
    const segWidth = widthFor(b, (a.pressure + c.pressure) / 2, velocity);
    const step = Math.max(0.5, b.spacing * segWidth);

    let dist = leftover;
    while (dist <= segLen) {
      const f = dist / segLen;
      const pr = lerp(a.pressure, c.pressure, f);
      stamps.push({
        x: lerp(a.x, c.x, f),
        y: lerp(a.y, c.y, f),
        width: widthFor(b, pr, velocity),
        opacity: opacityFor(b, pr),
      });
      dist += step;
    }
    leftover = dist - segLen;
  }
  return { stamps, carry: leftover };
}

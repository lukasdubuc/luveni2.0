// ─────────────────────────────────────────────────────────────
//  Luveni — low-weight vector garment silhouettes
//  Rendered instantly behind the heavy transparent PNG mockup so the
//  Yeezy-style grid reserves its box and never shifts (CLS = 0). Pure
//  inline SVG: a few hundred bytes, no network, no layout shift.
// ─────────────────────────────────────────────────────────────

export type GarmentKind = "tee" | "hoodie" | "hat" | "poster" | "pants" | "generic";

/** Best-effort garment classification from a product title. */
export function garmentKindFromTitle(title: string | undefined): GarmentKind {
  const t = (title || "").toLowerCase();
  if (/hoodie|sweatshirt|crewneck|pullover/.test(t)) return "hoodie";
  if (/hat|cap|beanie|snapback/.test(t)) return "hat";
  if (/poster|print|canvas|frame/.test(t)) return "poster";
  if (/pant|jogger|short|legging|trouser/.test(t)) return "pants";
  if (/tee|shirt|top|jersey/.test(t)) return "tee";
  return "generic";
}

const PATHS: Record<GarmentKind, string> = {
  // Simplified garment outlines on a 100x100 viewBox.
  tee: "M30 18 L42 12 Q50 18 58 12 L70 18 L82 30 L72 40 L68 36 L68 86 L32 86 L32 36 L28 40 L18 30 Z",
  hoodie: "M30 20 Q50 8 70 20 L84 32 L74 44 L70 40 L70 88 L30 88 L30 40 L26 44 L16 32 Z M42 16 Q50 26 58 16",
  hat: "M20 60 Q20 30 50 30 Q80 30 80 60 L80 64 L20 64 Z M20 64 L92 66 L92 72 L18 70 Z",
  poster: "M28 14 L72 14 L72 86 L28 86 Z",
  pants: "M34 14 L66 14 L70 88 L56 88 L50 44 L44 88 L30 88 Z",
  generic: "M30 20 L70 20 L74 40 L68 40 L68 86 L32 86 L32 40 L26 40 Z",
};

export function GarmentSilhouette({
  kind = "generic",
  className = "",
}: {
  kind?: GarmentKind;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      role="presentation"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={PATHS[kind]}
        fill="currentColor"
        opacity={0.06}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={1}
      />
    </svg>
  );
}

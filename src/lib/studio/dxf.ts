// ─────────────────────────────────────────────────────────────
//  Luveni Studio — DXF exporter (CLO 3D-style CAD pattern output)
//  Turns flat 2D pattern pieces (closed polygons, in millimetres) into
//  an AutoCAD R12 ASCII DXF — the de-facto sewing-pattern interchange
//  format. Each piece becomes a closed LWPOLYLINE on its own layer, with
//  optional notch/seam markers as POINT entities. Pure + dependency-free.
// ─────────────────────────────────────────────────────────────

export interface DxfPoint { x: number; y: number }

export interface PatternPiece {
  name: string;
  /** Outline in mm, counter-clockwise. Auto-closed if last ≠ first. */
  points: DxfPoint[];
  /** Optional internal markers (notches, drill holes). */
  markers?: DxfPoint[];
}

// DXF group code/value pair, one per line.
function pair(code: number, value: string | number): string {
  return `${code}\n${value}`;
}

function lwpolyline(layer: string, points: DxfPoint[]): string {
  const lines: string[] = [
    pair(0, "LWPOLYLINE"),
    pair(8, layer),
    pair(100, "AcDbEntity"),
    pair(100, "AcDbPolyline"),
    pair(90, points.length),
    pair(70, 1), // 1 = closed
  ];
  for (const p of points) {
    lines.push(pair(10, p.x.toFixed(3)), pair(20, p.y.toFixed(3)));
  }
  return lines.join("\n");
}

function pointEntity(layer: string, p: DxfPoint): string {
  return [pair(0, "POINT"), pair(8, layer), pair(10, p.x.toFixed(3)), pair(20, p.y.toFixed(3)), pair(30, 0)].join("\n");
}

/** Build a valid DXF document from pattern pieces. */
export function buildDxf(pieces: PatternPiece[]): string {
  const out: string[] = [];

  // HEADER — millimetre units ($INSUNITS = 4).
  out.push(
    pair(0, "SECTION"), pair(2, "HEADER"),
    pair(9, "$ACADVER"), pair(1, "AC1009"),
    pair(9, "$INSUNITS"), pair(70, 4),
    pair(0, "ENDSEC"),
  );

  // TABLES — one layer per piece.
  out.push(pair(0, "SECTION"), pair(2, "TABLES"), pair(0, "TABLE"), pair(2, "LAYER"), pair(70, pieces.length));
  pieces.forEach((p, i) => {
    out.push(
      pair(0, "LAYER"), pair(2, sanitizeLayer(p.name) || `PIECE_${i + 1}`),
      pair(70, 0), pair(62, (i % 7) + 1), pair(6, "CONTINUOUS"),
    );
  });
  out.push(pair(0, "ENDTAB"), pair(0, "ENDSEC"));

  // ENTITIES.
  out.push(pair(0, "SECTION"), pair(2, "ENTITIES"));
  pieces.forEach((p, i) => {
    const layer = sanitizeLayer(p.name) || `PIECE_${i + 1}`;
    const pts = closeRing(p.points);
    if (pts.length >= 2) out.push(lwpolyline(layer, pts));
    for (const m of p.markers ?? []) out.push(pointEntity(layer, m));
  });
  out.push(pair(0, "ENDSEC"));

  out.push(pair(0, "EOF"));
  return out.join("\n") + "\n";
}

function sanitizeLayer(name: string): string {
  return (name || "").toUpperCase().replace(/[^A-Z0-9_]+/g, "_").slice(0, 31);
}

// LWPOLYLINE with flag 70=1 is implicitly closed, so drop a duplicated
// trailing point if present.
function closeRing(points: DxfPoint[]): DxfPoint[] {
  if (points.length < 2) return points;
  const a = points[0], b = points[points.length - 1];
  if (a.x === b.x && a.y === b.y) return points.slice(0, -1);
  return points;
}

/** Convenience: trigger a browser download of a DXF for the given pieces. */
export function downloadDxf(pieces: PatternPiece[], filename = "luveni-pattern.dxf"): void {
  const blob = new Blob([buildDxf(pieces)], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

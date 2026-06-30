# Luveni Studio — Overhaul Prompt & Checklist

Goal: a browser design studio that feels like **Procreate** (paint/raster) fused
with **CLO 3D** (true garment + on-body preview), wired to **Printful/Apliiq**
real templates, print areas, and pricing — 10–15 years ahead of typical
print-on-demand designers.

This doc is the source of truth for the overhaul. It contains (A) a reusable
master prompt, (B) a phased checklist, and (C) an honest reality section on what
is achievable in-browser vs. via the manufacturer mockup API.

---

## A. Master prompt (reuse this for each phase)

> You are building "Luveni Studio", a TanStack Start + React + Konva (2D) +
> three.js / react-three-fiber (3D) design tool backed by Supabase edge
> functions and the Printful/Apliiq APIs. The editor must feel like Procreate
> for raster work and CLO 3D for garment preview. Every product loads its REAL
> Printful data: all print placements (front, back, sleeves, etc.), each with
> its exact template image, print-area box (px + inches @ dpi), and DPI. The
> canvas is true-to-print; the 3D view shows the actual garment shape worn by a
> proportional human with the design mapped per placement at real-world size.
> Pricing flows cost → margin → retail from live manufacturer cost. Build in
> vertical slices, verify each with `npm run build` and a real in-app pass, and
> never ship a slice that blanks the canvas or the preview. Prefer real glTF
> assets for the human/garment over procedural blobs; fall back gracefully.

---

## B. Phased checklist

### Phase 0 — Foundations (DONE / in this pass)
- [x] Public `proxy-image` edge function (no-JWT) so CDN images load CORS-clean.
- [x] Catalog template image loads into Konva via the proxy (no blank template).
- [x] Real front print-area (px @ dpi → inches) from `mockup-generator/printfiles`.
- [x] Real front mockup TEMPLATE (surface image + exact print box) from
      `mockup-generator/templates`; artboard = template, guide = real print area.
- [x] Unified chronological undo/redo (one action per step).
- [x] Bucket fill auto-creates a paint layer + color/tolerance options.
- [x] Cost → margin → retail pricing.
- [x] **Multi-placement data**: detail returns ALL placements (front/back/
      sleeves…), each with template + print box, stored on the project.

### Phase 1 — Multi-placement editor (IN PROGRESS)
- [x] Project data model: `product.placements[]` each with `{ placement,
      image_url, template_w/h, print_area, print_px, layers[] }`.
- [x] Placement tab bar in the editor (Front / Back / Sleeves…) that swaps the
      active template image, print guide, artboard, and **layer set**.
- [x] Save persists every placement's layers + preserves the product ref
      (fixes a bug where save wiped product/variant/placements).
- [ ] Per-placement thumbnails in the project card + a "placements designed" badge.
- [ ] Publish/fulfilment: send one print file per designed placement to Printful.
- [ ] Validation: warn if a layer extends outside its placement's print box.

### Phase 2 — Procreate-grade paint engine
- [x] Stroke stabilizer (moving-average smoothing) — adjustable per brush panel.
- [x] Pressure→size and pressure→opacity; brush opacity control.
- [ ] Brush engine: textured stamps, tilt, spacing, streamline; brush presets/library.
- [ ] Brush library (inking, pencil, airbrush, marker, texture) + import .brush-like presets.
- [ ] Per-layer: blend modes (full set), alpha-lock, clipping masks, layer groups.
- [ ] Selection tools: freehand/rect/ellipse, feather, transform within selection.
- [ ] Color: HSB wheel, palettes, eyedropper, gradient map, recolor.
- [ ] Adjustments: levels/curves, hue/sat, gaussian/motion blur, noise, liquify.
- [ ] Non-destructive filter stack per layer; GPU (WebGL/WebGPU) for big artboards.
- [ ] QuickShape, symmetry (radial/mandala), perspective guides, snapping.

### Phase 3 — CLO-style 3D
- [ ] Replace procedural blob with REAL rigged human glTF (CC0 / purchased) +
      real garment meshes per type (tee, hoodie, tank, long-sleeve, cap).
- [ ] Map each placement's design as a UV/Decal onto the correct garment region
      at true-to-print scale (inches → garment UV cm).
- [ ] Garment color/fabric (knit, fleece, twill) PBR materials; AO + soft studio HDRI.
- [ ] Light cloth drape (real-time sim or pre-baked morphs); wind/turntable.
- [ ] Body presets (size/height/skin) and pose presets.
- [ ] Keep the Printful photoreal mockup as the "Realistic / on-model" tab.

### Phase 4 — Pro polish
- [ ] Autosave + version history (named snapshots, restore).
- [ ] Templates/presets gallery, recent colors, keyboard map, command palette.
- [ ] Performance: tile/virtualize large artboards, web worker for flood/filters.
- [ ] Export: print-ready PNG/PDF per placement at exact DPI; bleed/safe lines.
- [ ] Mobile/stylus parity (Apple Pencil pressure, palm rejection).

---

## C. Honest reality notes
- **Photoreal human in-browser** is the hard part. three.js can't auto-produce a
  CLO-grade rigged human; it needs real glTF assets (a rigged body + garment
  meshes). The procedural figure will always read as stylized. The genuinely
  photoreal on-model render is Printful's **mockup generator** (already wired as
  the "Realistic" tab) — that should remain the customer-facing hero image; the
  3D view is the live editing aid.
- **Multi-placement** is a real data-model change (per-placement layer sets +
  publish per placement). Ship behind the placement tab bar; migrate existing
  single-canvas projects to "front".
- Verify every slice with `npm run build` AND a real in-app pass — the sandbox
  used to author this could not render the app, so visual sign-off is required
  before each phase is considered done.

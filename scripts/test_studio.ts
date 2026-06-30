// Run: bun scripts/test_studio.ts
import { buildDxf, type PatternPiece } from "../src/lib/studio/dxf";
import { buildStamps, widthFor, opacityFor, DEFAULT_BRUSH } from "../src/lib/studio/pressureBrush";

let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "  ✓" : "  ✗ FAIL:"} ${m}`); if (!c) fails++; };

console.log("DXF export");
const pieces: PatternPiece[] = [
  { name: "Front Panel", points: [{x:0,y:0},{x:100,y:0},{x:100,y:150},{x:0,y:150}], markers: [{x:50,y:10}] },
  { name: "Sleeve", points: [{x:0,y:0},{x:60,y:0},{x:30,y:80}] },
];
const dxf = buildDxf(pieces);
ok(dxf.startsWith("0\nSECTION"), "starts with SECTION");
ok(dxf.includes("EOF"), "ends with EOF marker");
ok((dxf.match(/LWPOLYLINE/g) || []).length === 2, "one polyline per piece");
ok(dxf.includes("FRONT_PANEL"), "layer name sanitized to FRONT_PANEL");
ok(dxf.includes("$INSUNITS"), "declares mm units");
ok((dxf.match(/\nPOINT\n/g) || []).length === 1, "marker emitted as POINT");

console.log("Pressure brush");
ok(widthFor(DEFAULT_BRUSH, 1, 0) > widthFor(DEFAULT_BRUSH, 0.2, 0), "more pressure → wider");
ok(widthFor(DEFAULT_BRUSH, 1, 5) < widthFor(DEFAULT_BRUSH, 1, 0), "faster → thinner (velocity taper)");
ok(opacityFor(DEFAULT_BRUSH, 1) > opacityFor(DEFAULT_BRUSH, 0.1), "more pressure → more opaque");
ok(widthFor(DEFAULT_BRUSH, 1, 0) >= 0.5, "width floored at 0.5");

// Even spacing along a straight 100px line.
const { stamps } = buildStamps(DEFAULT_BRUSH, [
  { x: 0, y: 0, pressure: 1, t: 0 },
  { x: 100, y: 0, pressure: 1, t: 50 },
]);
ok(stamps.length > 5, `interpolated into ${stamps.length} stamps (no gaps)`);
ok(Math.abs(stamps[1].x - stamps[0].x - (stamps[2].x - stamps[1].x)) < 0.001, "stamps evenly spaced");

// Carry lets streamed segments continue gap-free.
const r1 = buildStamps(DEFAULT_BRUSH, [{x:0,y:0,pressure:1,t:0},{x:10,y:0,pressure:1,t:5}]);
const r2 = buildStamps(DEFAULT_BRUSH, [{x:10,y:0,pressure:1,t:5},{x:20,y:0,pressure:1,t:10}], r1.carry);
ok(r2.stamps.length > 0 && r1.carry >= 0, "carry threads spacing across streamed batches");

console.log("");
if (fails === 0) console.log("ALL PASSED ✅"); else { console.error(`${fails} FAILED ❌`); process.exit(1); }

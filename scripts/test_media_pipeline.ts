// Run: bun scripts/test_media_pipeline.ts
// Verifies the multi-vendor media pipeline pure functions against
// realistic Printful / Apliiq / Zendrop payload shapes.
import {
  parseManufacturerMedia,
  selectTikTokImages,
  applyInventoryBuffer,
  splitCartByVendor,
  TIKTOK_MAX_IMAGES,
} from "../src/lib/media-pipeline";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

// ── Printful: multiple files per variant must all survive ──────
console.log("Printful media parsing");
const printful = {
  sync_variants: [
    { sku: "BLK-S", id: 101, files: [
      { id: 1, type: "preview", preview_url: "https://cdn/blk-front.png" },
      { id: 2, type: "back", preview_url: "https://cdn/blk-back.png" },
      { id: 3, type: "default", preview_url: "https://cdn/blk-front.png" }, // dup url
    ]},
    { sku: "WHT-S", id: 102, files: [
      { id: 4, type: "preview", preview_url: "https://cdn/wht-front.png" },
      { id: 5, type: "lifestyle", preview_url: "https://cdn/wht-model.jpg" },
    ]},
  ],
};
const pfMedia = parseManufacturerMedia("printful", printful);
assert(pfMedia.length === 4, "all 4 unique files retained (1 dup dropped per-variant)");
assert(pfMedia.some((m) => m.viewType === "back_flat"), "back view classified (not lost)");
assert(pfMedia.filter((m) => m.variantKey === "BLK-S").length === 2, "BLK-S keeps front + back");
assert(pfMedia.find((m) => m.url.endsWith("blk-front.png"))!.isPrimary, "preview file is primary");

// ── Apliiq: per-colour mockups ─────────────────────────────────
console.log("Apliiq media parsing");
const apliiq = { mockups: [
  { url: "https://cdn/a-front.png", side: "front", variantId: "red" },
  { url: "https://cdn/a-back.png", side: "back", variantId: "red" },
  { url: "https://cdn/a-front2.png", side: "front", variantId: "blue" },
]};
const apMedia = parseManufacturerMedia("apliiq", apliiq);
assert(apMedia.length === 3, "all apliiq mockups retained");
assert(apMedia.filter((m) => m.variantKey === "red").length === 2, "red has front + back");

// ── Zendrop: product gallery + variant images ──────────────────
console.log("Zendrop media parsing");
const zendrop = {
  images: ["https://cdn/z-1.jpg", { src: "https://cdn/z-2.jpg", alt: "back view" }],
  variants: [{ id: "v1", title: "Green", image: { src: "https://cdn/z-green.jpg" } }],
};
const zMedia = parseManufacturerMedia("zendrop", zendrop);
assert(zMedia.length === 3, "zendrop gallery (2) + variant (1) retained");
assert(zMedia.find((m) => m.url.endsWith("z-2.jpg"))!.viewType === "back_flat", "alt text classifies back");
assert(zMedia.find((m) => m.variantKey === "v1") !== undefined, "variant image keyed to v1");

// ── TikTok 9-image algorithm ───────────────────────────────────
console.log("TikTok 9-image mapping");
// Multi-variant: one primary per variant.
const manyVariants = Array.from({ length: 12 }, (_, i) => ({
  variantKey: `c${i}`, viewType: "front_flat" as const, url: `https://cdn/c${i}.png`,
  isPrimary: true, isTransparent: true, position: 0, source: "printful" as const, metadata: {},
}));
const tiktokMany = selectTikTokImages(manyVariants);
assert(tiktokMany.length === TIKTOK_MAX_IMAGES, "12 variants capped at 9 images");
assert(new Set(tiktokMany).size === 9, "9 distinct variant primaries");

// Single variant: fill slots with secondary views.
const single = parseManufacturerMedia("printful", {
  sync_variants: [{ sku: "ONLY", id: 1, files: [
    { id: 1, type: "preview", preview_url: "https://cdn/p.png" },
    { id: 2, type: "back", preview_url: "https://cdn/b.png" },
    { id: 3, type: "lifestyle", preview_url: "https://cdn/l.jpg" },
  ]}],
});
const tiktokSingle = selectTikTokImages(single);
assert(tiktokSingle[0].endsWith("p.png"), "primary first");
assert(tiktokSingle.includes("https://cdn/b.png") && tiktokSingle.length === 3, "secondary views fill slots");

// ── Inventory dampener ─────────────────────────────────────────
console.log("Inventory buffer");
assert(applyInventoryBuffer(10, 3) === 7, "10 - 3 = 7");
assert(applyInventoryBuffer(2, 5) === 0, "never negative");
assert(applyInventoryBuffer(5.9, 2) === 3, "floors physical");

// ── Split-fulfillment routing ──────────────────────────────────
console.log("Split-fulfillment routing");
const groups = splitCartByVendor([
  { sku: "a", quantity: 1, source: "printful" },
  { sku: "b", quantity: 2, source: "zendrop" },
  { sku: "c", quantity: 1, source: "printful" },
  { sku: "d", quantity: 1, source: "manual" },
  { sku: "e", quantity: 1, source: "apliiq" },
]);
assert(groups.printful.length === 2, "printful lines grouped");
assert(groups.zendrop.length === 1 && groups.apliiq.length === 1, "zendrop + apliiq routed");
assert(groups.manual.length === 1, "unknown/manual kept for human handling");

console.log("");
if (failures === 0) {
  console.log("ALL PASSED ✅");
} else {
  console.error(`${failures} FAILED ❌`);
  process.exit(1);
}

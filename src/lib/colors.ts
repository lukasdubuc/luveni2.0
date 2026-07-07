// ─────────────────────────────────────────────────────────────
//  Luveni — color resolution (single source of truth)
//
//  Maps vendor color names ("Heather Grey", "coffee", "Dark Brown") to hex
//  so swatches render real fills and the darkest-colorway rule can rank
//  variants by luminance. Used by the offer page swatches AND the shared
//  dark-hero picker — one dictionary, no drift.
// ─────────────────────────────────────────────────────────────

const _colorCache: Record<string, string> = {};

const _colorMap: Record<string, string> = {
  white: "#ffffff", "off-white": "#f8f5f0", "off white": "#f8f5f0",
  black: "#111111", "jet black": "#0a0a0a", "vintage black": "#2a2a2a",
  charcoal: "#4a5568", gray: "#808080", grey: "#808080",
  blue: "#3182ce", navy: "#001f5b",
  green: "#38a169", forest: "#228b22",
  red: "#e53e3e", maroon: "#800000",
  pink: "#ed64a6", orange: "#ed8936",
  yellow: "#ecc94b", gold: "#d69e2e",
  purple: "#9f7aea", brown: "#a0522d",

  // Explicit garment color names — "{qualifier} {basecolor}" patterns the
  // canvas check and heuristic below both miss. Mapped against every color
  // name actually present in the catalog rather than guessed at.
  agave: "#a7ab93",
  anthracite: "#33363a",
  ash: "#c7c8c6",
  "bio white": "#f5f5f0",
  birch: "#d7ccc0",
  bone: "#e3dac9",
  "brick red": "#a03c34",
  "carolina blue": "#7bafd4",
  cranberry: "#8c1f3b",
  "dark chocolate": "#3b2313",
  "dark green": "#1e4620",
  "dark grey": "#4a4a4a",
  "desert dust": "#c9a98d",
  "desert pink": "#d8a398",
  "green camo": "#5d6b3f",
  "heather charcoal": "#4b4b4d",
  "heather grey": "#a9a9ab",
  "heather royal": "#3f5fa0",
  heliconia: "#e0218a",
  "ice grey": "#d6d6d8",
  "jade dome": "#2e8b83",
  khaki: "#c3b091",
  "light blue": "#add8e6",
  "light pink": "#ffb6c1",
  mineral: "#7b8b8e",
  natural: "#ede6d6",
  "petrol blue": "#1f4e5f",
  sand: "#c2b280",
  "slate blue": "#647a8d",
  spruce: "#1f3a2e",
  stone: "#a79e8e",
  "stone grey": "#8f8a82",
  "vintage gold": "#c9a227",
  "vintage white": "#f0ead6",

  // Common vendor (CJ) color words the canvas/heuristic miss.
  coffee: "#6f4e37", "dark brown": "#3b2313", "light brown": "#b07d52",
  wine: "#722f37", burgundy: "#800020", apricot: "#fbceb1",
  beige: "#e8dcc4", cream: "#fffdd0", ivory: "#fffff0",
  olive: "#808000", "army green": "#4b5320", mustard: "#e1ad01",
  rust: "#b7410e", lavender: "#b57edc", mint: "#98ff98",
  coral: "#ff7f50", salmon: "#fa8072", tan: "#d2b48c",
  camel: "#c19a6b", chocolate: "#7b3f00", teal: "#008080",
  turquoise: "#40e0d0", cyan: "#00b7eb", magenta: "#c71585",
  peach: "#ffcba4", plum: "#8e4585", "rose red": "#c21e56",
  "light green": "#90ee90", "dark blue": "#00008b", "sky blue": "#87ceeb",
  "wine red": "#722f37", "light grey": "#d3d3d3", "light gray": "#d3d3d3",
  "dark gray": "#4a4a4a", silver: "#c0c0c0",
};

/** Browser canvas check for real CSS color names (SSR-safe: null on server). */
function _canvasColor(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#010101";
    ctx.fillStyle = name;
    return ctx.fillStyle !== "#010101" ? ctx.fillStyle : null;
  } catch { return null; }
}

/**
 * Resolve a string to a hex CSS color, or null when it isn't recognizable as
 * a color (a style code, a SKU, a product title) so callers can fall back to
 * an image swatch instead of a grey dot.
 */
export function tryResolveColor(value: string): string | null {
  const key = value.toLowerCase().trim();
  if (key in _colorCache) return _colorCache[key] || null;

  if (_colorMap[key]) return (_colorCache[key] = _colorMap[key]);

  if (/^#([0-9a-f]{3,8})$/i.test(key) || /^rgba?\(|^hsla?\(/i.test(key)) {
    return (_colorCache[key] = key);
  }

  const canvasCheck = _canvasColor(key);
  if (canvasCheck) return (_colorCache[key] = canvasCheck);

  // "{qualifier} {basecolor}" heuristic (light/dark/vintage/washed shifts).
  const words = key.split(/[\s_\-\/]+/).filter(Boolean);
  if (words.length > 1) {
    const modifiers: Record<string, number> = {
      light: 60, pale: 70, soft: 50, bright: 30, neon: 40,
      dark: -60, deep: -70, vintage: -20, faded: 40, washed: 35,
    };
    let shift = 0;
    const nonModifierWords: string[] = [];
    for (const word of words) {
      if (modifiers[word] !== undefined) shift += modifiers[word];
      else nonModifierWords.push(word);
    }
    const candidates = [
      nonModifierWords[nonModifierWords.length - 1],
      nonModifierWords[0],
    ].filter(Boolean);
    for (const baseWord of candidates) {
      const baseHex = _colorMap[baseWord] ?? _canvasColor(baseWord);
      if (baseHex && /^#[0-9a-f]{6}$/i.test(baseHex)) {
        const r = Math.max(0, Math.min(255, parseInt(baseHex.slice(1, 3), 16) + shift));
        const g = Math.max(0, Math.min(255, parseInt(baseHex.slice(3, 5), 16) + shift));
        const b = Math.max(0, Math.min(255, parseInt(baseHex.slice(5, 7), 16) + shift));
        const adjusted = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
        return (_colorCache[key] = adjusted);
      }
    }
  }

  return (_colorCache[key] = ""); // cache the miss; "" → null via `|| null`
}

/** Resolve to hex with a neutral-grey fallback (for guaranteed fills). */
export function resolveColor(value: string): string {
  return tryResolveColor(value) || "#888888";
}

/**
 * Relative luminance (0 = black, 1 = white) of a color NAME. Unresolvable
 * names return null. Drives the "always the darkest colorway" rule.
 */
export function colorLuminance(value: string): number | null {
  const hex = tryResolveColor(value);
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

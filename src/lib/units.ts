// ─────────────────────────────────────────────────────────────
//  Luveni — locale-aware metric/imperial measurement system
//  Reads the visitor's region to pick the right units (inches/cm,
//  oz/g) without cluttering the minimalist UI. Only the US, Liberia,
//  and Myanmar use imperial by default; everywhere else is metric.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

export type MeasurementSystem = "imperial" | "metric";

const IMPERIAL_REGIONS = new Set(["US", "LR", "MM"]);

/** Region code from the browser locale (e.g. "en-GB" → "GB"). */
function regionFromLocale(): string {
  if (typeof navigator === "undefined") return "US";
  const tag = navigator.language || (navigator.languages && navigator.languages[0]) || "en-US";
  try {
    // maximize() isn't in every TS lib target; guard it.
    const loc = new Intl.Locale(tag) as Intl.Locale & { maximize?: () => Intl.Locale };
    const region = (loc.maximize ? loc.maximize() : loc).region;
    if (region) return region;
  } catch { /* fall through */ }
  const parts = tag.split("-");
  return (parts[1] || "US").toUpperCase();
}

export function detectMeasurementSystem(): MeasurementSystem {
  return IMPERIAL_REGIONS.has(regionFromLocale()) ? "imperial" : "metric";
}

const IN_TO_CM = 2.54;
const OZ_TO_G = 28.3495;

export function formatLength(inches: number, system: MeasurementSystem, digits = 1): string {
  return system === "imperial"
    ? `${round(inches, digits)}″`
    : `${round(inches * IN_TO_CM, digits)} cm`;
}

export function formatWeight(ounces: number, system: MeasurementSystem, digits = 1): string {
  if (system === "imperial") return `${round(ounces, digits)} oz`;
  const grams = ounces * OZ_TO_G;
  return grams >= 1000 ? `${round(grams / 1000, 2)} kg` : `${round(grams, 0)} g`;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Hook: the active measurement system with a manual override persisted to
 * localStorage, defaulting to the visitor's region.
 */
export function useMeasurementSystem(): readonly [MeasurementSystem, (s: MeasurementSystem) => void] {
  const [system, setSystem] = useState<MeasurementSystem>("metric");
  useEffect(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("measurement_system") : null;
    setSystem(saved === "imperial" || saved === "metric" ? saved : detectMeasurementSystem());
  }, []);
  const set = (s: MeasurementSystem) => {
    setSystem(s);
    try { localStorage.setItem("measurement_system", s); } catch { /* ignore */ }
  };
  return [system, set] as const;
}

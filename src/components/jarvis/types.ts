// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/visual/types.ts
//
//  Structured "visual" payload surfaced by the brain alongside the
//  spoken reply. Drives the desktop-only VisualStage.
// ─────────────────────────────────────────────────────────────

export interface VisualResult {
  title:   string;
  url:     string;
  snippet: string;
}

export type VisualPayload =
  | { kind: 'search'; query: string; results: VisualResult[]; images: string[] }
  | { kind: 'images'; query: string; images: string[] }
  | { kind: 'site';   query: string; path?: string };

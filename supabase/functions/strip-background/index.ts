// ─────────────────────────────────────────────────────────────
//  Luveni GM — strip-background (Supabase Edge Function)
//
//  Server-side transparent-PNG pipeline for ONE product. Mirrors the
//  browser CjTransparencyPanel but runs server-side via a hosted
//  background-removal API (see _shared/bg-removal.ts). Called
//  server-to-server by the vendor syncs, the sweep cron, and Astra —
//  NOT from an admin JWT.
//
//  POST { productId: string, imageUrl?: string }
//  Auth: service-role bearer OR x-cron-key (isCronOrService).
//  Deploy with verify_jwt = false (auth handled inside).
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json } from "../_shared/http.ts";
import { isCronOrService } from "../_shared/cj.ts";
import { runStripBackground } from "../_shared/bg-removal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (!(await isCronOrService(req))) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const productId = String(body?.productId ?? "").trim();
  if (!productId) return json({ error: "productId required" }, 400);

  const result = await runStripBackground(productId, body?.imageUrl ?? null);
  if (!result.ok) return json(result, 502);
  return json(result, 200);
});

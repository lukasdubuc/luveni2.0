// ─────────────────────────────────────────────────────────────
//  Luveni GM — strip-background-sweep (Supabase Edge Function)
//
//  Batch driver for the server-side transparent-PNG pipeline. Finds up to
//  `limit` published, non-archived products that are NOT yet treated (no
//  own-storage transparent primary) and runs the SHARED core on each. Kept
//  small per run to stay within edge CPU/wall-clock limits — call it
//  repeatedly (on import + on a cron) to drain the backlog.
//
//  POST { limit?: number = 5, source?: string }
//  Auth: service-role bearer OR x-cron-key (isCronOrService).
//  Deploy with verify_jwt = false (auth handled inside).
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json } from "../_shared/http.ts";
import { isCronOrService } from "../_shared/cj.ts";
import { runStripBackground, findUntreatedProducts } from "../_shared/bg-removal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (!(await isCronOrService(req))) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const limit = Math.min(Math.max(Number(body?.limit ?? 5) || 5, 1), 20);
  const source = body?.source ? String(body.source) : null;

  const targets = await findUntreatedProducts(limit, source);

  let treated = 0;
  const errors: string[] = [];
  for (const p of targets) {
    const r = await runStripBackground(p.id);
    if (r.ok && !r.skipped) treated++;
    else if (!r.ok) errors.push(`${p.id}: ${r.error}`);
  }

  return json({ processed: targets.length, treated, errors });
});

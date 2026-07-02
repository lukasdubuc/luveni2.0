// ─────────────────────────────────────────────────────────────
//  Luveni GM — pricing-engine (Supabase Edge Function)
//
//  The retail pricing calculator, callable by the admin UI, the ops
//  fleet (Orion/Astra), and cron. Formula + rules in _shared/pricing.ts
//  (parameters live in the pricing_rules table).
//
//  Actions:
//    { action: "quote", cost_cents, title?, category? }
//        → full price breakdown (retail, fees, profit, margin, rule)
//    { action: "reprice", source?, productId?, publish?, formatTitles? }
//        → reprices products from their stored vendor COST. Per variant:
//          cost_cents is preserved (seeded from the old price on first
//          run), price_cents becomes retail. Product price = cheapest
//          variant retail. publish:true also sets is_published.
//
//  Never derives cost from retail: once variants carry cost_cents, that
//  is the basis forever.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, SUPABASE_URL, SERVICE_KEY } from "../_shared/http.ts";
import { isCronOrService } from "../_shared/cj.ts";
import { loadPricingRules, matchRule, computeRetail, formatTitle } from "../_shared/pricing.ts";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isCronOrService(req))) {
    const authErr = await requireAdmin(req);
    if (authErr) return authErr;
  }

  const body = await req.json().catch(() => ({}));
  const rules = await loadPricingRules();
  if (!rules.length) return json({ error: "pricing_rules table is empty" }, 500);

  if (body.action === "quote") {
    const cost = Number(body.cost_cents) || 0;
    if (cost <= 0) return json({ error: "cost_cents required" }, 400);
    const rule = matchRule(String(body.title ?? ""), rules, body.category);
    return json({ ok: true, ...computeRetail(cost, rule), category: rule.category });
  }

  if (body.action === "reprice") {
    let url = `${SUPABASE_URL}/rest/v1/products?is_archived=eq.false&select=id,title,price_cents,cost_cents,category,variants,is_published`;
    if (body.productId) url += `&id=eq.${encodeURIComponent(body.productId)}`;
    else if (body.source) url += `&source=eq.${encodeURIComponent(body.source)}`;
    const res = await fetch(url, { headers: svc() });
    const products: any[] = res.ok ? await res.json().catch(() => []) : [];

    let repriced = 0;
    const results: any[] = [];
    const errors: string[] = [];

    for (const p of products) {
      try {
        const title = body.formatTitles ? formatTitle(p.title) : p.title;
        const rule = matchRule(title, rules, p.category);
        const variants: any[] = Array.isArray(p.variants) ? p.variants : [];

        let minCost = Infinity;
        let minRetail = Infinity;
        for (const v of variants) {
          // First run: the imported price IS the vendor cost — capture it.
          const vcost = Number(v.cost_cents ?? v.price_cents) || 0;
          if (vcost <= 0) continue;
          const b = computeRetail(vcost, rule);
          v.cost_cents = vcost;
          v.price_cents = b.retail_cents;
          if (vcost < minCost) minCost = vcost;
          if (b.retail_cents < minRetail) minRetail = b.retail_cents;
        }
        // No usable variants → fall back to product-level cost.
        if (minCost === Infinity) {
          const pcost = Number(p.cost_cents ?? p.price_cents) || 0;
          if (pcost <= 0) { errors.push(`${p.title}: no cost basis`); continue; }
          minCost = pcost;
          minRetail = computeRetail(pcost, rule).retail_cents;
        }

        const patch: any = {
          title,
          cost_cents: minCost,
          price_cents: minRetail,
          shipping_cents: rule.ship_first_cents,
          category: rule.key,
          variants,
          updated_at: new Date().toISOString(),
        };
        if (body.publish === true) patch.is_published = true;

        const ok = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
          method: "PATCH",
          headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        }).then((r) => r.ok);
        if (!ok) { errors.push(`${p.title}: update failed`); continue; }
        repriced++;
        results.push({ id: p.id, title, rule: rule.key, cost_cents: minCost, retail_cents: minRetail });
      } catch (e: any) {
        errors.push(`${p.title}: ${e.message}`);
      }
    }
    return json({ ok: true, repriced, total: products.length, results, errors });
  }

  return json({ error: "action must be 'quote' or 'reprice'" }, 400);
});

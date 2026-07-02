// ─────────────────────────────────────────────────────────────
//  Luveni GM — shared CJ Dropshipping API helpers (Deno)
//
//  Auth: CJ issues 15-day access tokens but rate-limits getAccessToken to
//  ~1/300s, so the token is cached in site_config.metadata.cj_token and
//  reused until ~12 days old.
//
//  Field shapes below were confirmed against live CJ API 2.0 responses
//  (2026-07-01): product/myProduct/query → data.content[] {productId,
//  nameEn, sku, bigImage, sellPrice, vid, listedShopIds}; product/query →
//  {productNameEn, productImageSet[], description?}; product/variant/query
//  → data[] {vid, variantSku, variantKey "Yellow-M", variantSellPrice,
//  variantImage}; product/stock/queryByVid → data[] per warehouse
//  {areaEn, countryCode, storageNum, totalInventoryNum, cjInventoryNum,
//  factoryInventoryNum}.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { SUPABASE_URL, SERVICE_KEY } from "./http.ts";

export const CJ_BASE = Deno.env.get("CJ_API_BASE") || "https://developers.cjdropshipping.com/api2.0/v1";
const CJ_EMAIL = Deno.env.get("CJ_EMAIL") || "";
const CJ_API_KEY = Deno.env.get("CJ_API_KEY") || "";

const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

export function cjConfigured(): boolean {
  return !!(CJ_EMAIL && CJ_API_KEY);
}

/** Cached CJ access token (site_config.metadata.cj_token), refreshed when >12d old. */
export async function getCjToken(): Promise<string> {
  const q = await fetch(`${SUPABASE_URL}/rest/v1/site_config?id=eq.main&select=metadata`, { headers: svc() })
    .then((r) => r.json()).catch(() => []);
  const meta = q?.[0]?.metadata ?? {};
  const cached = meta?.cj_token;
  if (cached?.token && Date.now() - (cached.at ?? 0) < 12 * 24 * 3600 * 1000) return cached.token;

  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: CJ_EMAIL, password: CJ_API_KEY }),
  });
  const b = await res.json().catch(() => ({}));
  const token = b?.data?.accessToken || "";
  if (!token) throw new Error(`CJ auth failed (${res.status}): ${b?.message ?? "no token"}`);
  await fetch(`${SUPABASE_URL}/rest/v1/site_config?id=eq.main`, {
    method: "PATCH",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ metadata: { ...meta, cj_token: { token, at: Date.now() } } }),
  }).catch(() => {});
  return token;
}

export async function cjGet(token: string, path: string): Promise<any> {
  const res = await fetch(`${CJ_BASE}/${path}`, { headers: { "CJ-Access-Token": token } });
  const b = await res.json().catch(() => ({}));
  if (!res.ok || b?.code !== 200) {
    throw new Error(`CJ ${path} → ${res.status}/${b?.code}: ${b?.message ?? ""}`);
  }
  return b.data;
}

/** Total sellable stock for a variant, summed across warehouses.
 *  Uses totalInventoryNum (CJ-held + factory) — CJ procures factory stock
 *  on demand, so it counts as sellable for dropshipping. Per-warehouse
 *  detail is returned for storage on the variant. */
export function summarizeStock(rows: any[]): { total: number; cjHeld: number; warehouses: any[] } {
  let total = 0; let cjHeld = 0;
  const warehouses: any[] = [];
  for (const r of rows ?? []) {
    const t = Number(r?.totalInventoryNum ?? r?.storageNum ?? 0) || 0;
    const c = Number(r?.cjInventoryNum ?? 0) || 0;
    total += t; cjHeld += c;
    warehouses.push({
      area: r?.areaEn ?? r?.areaId ?? "?",
      country: r?.countryCode ?? "?",
      total: t,
      cj_held: c,
      factory: Number(r?.factoryInventoryNum ?? 0) || 0,
    });
  }
  return { total, cjHeld, warehouses };
}

/** Gate for sync functions: service-role bearer or x-cron-key header.
 *  The key is checked against the CRON_KEY env secret AND
 *  site_config.metadata.cron_key (the DB copy applies immediately; env
 *  secrets can lag several minutes behind a write). */
export async function isCronOrService(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (SERVICE_KEY && auth === `Bearer ${SERVICE_KEY}`) return true;
  const given = req.headers.get("x-cron-key") || "";
  if (!given) return false;
  const envKey = Deno.env.get("CRON_KEY") || "";
  if (envKey && given === envKey) return true;
  const q = await fetch(`${SUPABASE_URL}/rest/v1/site_config?id=eq.main&select=metadata`, { headers: svc() })
    .then((r) => r.json()).catch(() => []);
  const dbKey = q?.[0]?.metadata?.cron_key || "";
  return !!dbKey && given === dbKey;
}

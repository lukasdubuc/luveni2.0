import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/printful-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // ───────────────────────────────────────────────────────────
          // 0. Require an authenticated admin caller
          // ───────────────────────────────────────────────────────────
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return new Response(JSON.stringify({ error: "Server misconfigured (Missing Supabase credentials)" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const token = authHeader.slice("Bearer ".length);
          const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });

          const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
          const userId = claimsData?.claims?.sub;
          if (claimsErr || !userId) {
            return new Response(JSON.stringify({ error: "Unauthorized (Invalid session claims)" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
            _user_id: userId,
            _role: "admin",
          });
          if (roleErr || !isAdmin) {
            return new Response(JSON.stringify({ error: "Forbidden (Requires admin privileges)" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          if (!supabaseAdmin) {
            return new Response(JSON.stringify({ error: "Server misconfigured (Failed to import supabaseAdmin)" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          // ───────────────────────────────────────────────────────────
          // 1. Validate API Key
          // ───────────────────────────────────────────────────────────
          const apiKey = process.env.PRINTFUL_API_KEY;

          if (!apiKey) {
            return new Response(
              JSON.stringify({
                error: "Missing PRINTFUL_API_KEY env var",
              }),
              {
                status: 500,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
          }

          // ───────────────────────────────────────────────────────────
          // 2. Fetch Product List
          // ───────────────────────────────────────────────────────────
          // Multi-store accounts must scope requests with a store id.
          const storeId = process.env.PRINTFUL_STORE_ID;
          const printfulHeaders: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
          };
          if (storeId) printfulHeaders["X-PF-Store-Id"] = storeId;

          const listRes = await fetch(
            "https://api.printful.com/sync/products",
            { headers: printfulHeaders }
          );

          if (!listRes.ok) {
            // Surface Printful's own message so the cause is obvious in the
            // admin toast (e.g. 401 invalid key, 403 store scope required).
            const bodyText = await listRes.text().catch(() => "");
            let detail = bodyText;
            try {
              detail = JSON.parse(bodyText)?.result || JSON.parse(bodyText)?.error?.message || bodyText;
            } catch { /* keep raw text */ }
            const hint =
              listRes.status === 401
                ? " — PRINTFUL_API_KEY is missing or invalid (check Cloudflare env)."
                : listRes.status === 403
                ? " — token lacks access; multi-store accounts need PRINTFUL_STORE_ID set."
                : "";
            return new Response(
              JSON.stringify({
                error: `Printful list error ${listRes.status}: ${detail || listRes.statusText}${hint}`,
              }),
              {
                status: 502,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
          }

          const { result } = (await listRes.json()) as {
            result: any[];
          };

          console.log(
            "PRINTFUL PRODUCTS:",
            result?.length
          );

          if (!result || result.length === 0) {
            return new Response(
              JSON.stringify({
                synced: 0,
                message:
                  "No products found in Printful store",
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );
          }

          // ───────────────────────────────────────────────────────────
          // 3. Sync Products
          // ───────────────────────────────────────────────────────────
          let synced = 0;
          const errors: string[] = [];

          for (const item of result) {
            try {
              const detailRes = await fetch(
                `https://api.printful.com/sync/products/${item.id}`,
                { headers: printfulHeaders }
              );

              if (!detailRes.ok) {
                errors.push(
                  `Product ${item.id}: Printful detail error ${detailRes.status}`
                );
                continue;
              }

              const { result: detail } =
                (await detailRes.json()) as {
                  result: any;
                };

              const syncProduct =
                detail.sync_product ?? {};

              const syncVariants: any[] =
                detail.sync_variants ?? [];

              const productName =
                syncProduct.name ??
                item.name ??
                `product-${item.id}`;

              const slug = productName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");

              const validPrices = syncVariants
                .map((v: any) =>
                  Math.round(
                    parseFloat(
                      v.retail_price ?? "0"
                    ) * 100
                  )
                )
                .filter(
                  (p: number) =>
                    Number.isFinite(p) && p > 0
                );

              const priceCents =
                validPrices.length > 0
                  ? Math.min(...validPrices)
                  : 0;

              const imageUrls: string[] = Array.from(
                new Set(
                  syncVariants
                    .flatMap(
                      (v: any) => v.files || []
                    )
                    .map(
                      (f: any) =>
                        f.preview_url ||
                        f.thumbnail_url ||
                        f.url
                    )
                    .filter(Boolean)
                )
              );

              if (
                imageUrls.length === 0 &&
                syncProduct.thumbnail_url
              ) {
                imageUrls.push(
                  syncProduct.thumbnail_url
                );
              }

              if (
                imageUrls.length === 0 &&
                item.thumbnail_url
              ) {
                imageUrls.push(item.thumbnail_url);
              }

              const variants = syncVariants.map(
                (v: any) => {
                  const parts = (v.name ?? "")
                    .split("/")
                    .map((p: string) =>
                      p.trim()
                    );

                  const attributes: Record<
                    string,
                    string
                  > = {};

                  parts.forEach(
                    (
                      part: string,
                      i: number
                    ) => {
                      if (i === 0) {
                        attributes["size"] =
                          part;
                      } else if (i === 1) {
                        attributes["color"] =
                          part;
                      } else {
                        attributes[
                          `option_${i}`
                        ] = part;
                      }
                    }
                  );

                  return {
                    sku:
                      v.sku ??
                      String(v.id),

                    price_cents: Math.round(
                      parseFloat(
                        v.retail_price ?? "0"
                      ) * 100
                    ),

                    external_sku: String(v.id),

                    fulfillment_provider:
                      "printful",

                    attributes,

                    stock: 999,
                  };
                }
              );

              const {
                error: upsertError,
              } = await supabaseAdmin
                .from("products")
                .upsert(
                  {
                    title: productName,
                    slug,
                    description:
                      syncProduct.external_name ??
                      productName,
                    price_cents:
                      priceCents,
                    image_urls:
                      imageUrls,
                    is_archived: false,
                    is_published: true,
                    printful_id: String(
                      item.id
                    ),
                    variants:
                      variants.length > 0
                        ? variants
                        : null,
                    updated_at:
                      new Date().toISOString(),
                  },
                  {
                    onConflict:
                      "printful_id",
                    ignoreDuplicates:
                      false,
                  }
                );

              if (upsertError) {
                console.error("UPSERT ERROR:", upsertError);
                errors.push(
                  `Product ${item.id} (${productName}): ${upsertError.message}`
                );
                continue;
              }

              synced++;
            } catch (e: any) {
              console.error(`SYNC ERROR PRODUCT ${item.id}:`, e);
              errors.push(
                `Product ${item.id}: ${e.message ?? "unknown error"}`
              );
            }
          }

          // ───────────────────────────────────────────────────────────
          // 4. Tombstone products no longer in Printful
          // ───────────────────────────────────────────────────────────
          const livePrintfulIds = result.map((item: any) => String(item.id));

          const { data: existingProducts, error: fetchErr } = await supabaseAdmin
            .from("products")
            .select("id, printful_id, title")
            .not("printful_id", "is", null);

          let tombstoned = 0;
          const tombstoneErrors: string[] = [];

          if (!fetchErr && existingProducts) {
            const stale = existingProducts.filter(
              (p: any) => !livePrintfulIds.includes(p.printful_id)
            );

            for (const p of stale) {
              const { error: archiveErr } = await supabaseAdmin
                .from("products")
                .update({
                  is_published: false,
                  is_archived: true,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", p.id);

              if (archiveErr) {
                tombstoneErrors.push(
                  `Tombstone ${p.printful_id} (${p.title}): ${archiveErr.message}`
                );
              } else {
                tombstoned++;
              }
            }
          } else if (fetchErr) {
            console.error("TOMBSTONE FETCH ERROR:", fetchErr);
            tombstoneErrors.push(`Tombstone fetch failed: ${fetchErr.message}`);
          }

          // ───────────────────────────────────────────────────────────
          // 5. Query Active Apliq Products from Database (Defensively Wrapped)
          // ───────────────────────────────────────────────────────────
          let apliqCount = 0;
          try {
            const { data: activeApliqProducts, error: apliqQueryError } = await supabaseAdmin
              .from("products")
              .select("id")
              .not("apliq_id", "is", null);

            if (apliqQueryError) {
              console.error("APLIQ DATABASE QUERY ERROR:", apliqQueryError);
            } else if (activeApliqProducts) {
              apliqCount = activeApliqProducts.length;
            }
          } catch (dbErr: any) {
            console.error("Defensive catch on Apliq database query exception:", dbErr);
          }

          // ───────────────────────────────────────────────────────────
          // 6. Response
          // ───────────────────────────────────────────────────────────
          return new Response(
            JSON.stringify({
              synced,
              apliqSynced: apliqCount,
              total: result.length,
              tombstoned,
              errors: [...errors, ...tombstoneErrors],
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        } catch (globalErr: any) {
          console.error("CRITICAL SYNC SERVER ERROR:", globalErr);
          return new Response(
            JSON.stringify({
              error: "Sync Server Exception",
              message: globalErr.message || String(globalErr),
              stack: globalErr.stack || ""
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        }
      },
    },
  },
});
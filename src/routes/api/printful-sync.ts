import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Printful sync_variant.name is formatted as:
//   "{Product Name} / {Color} / {Size}"   (apparel, 2 attribute axes)
//   "{Product Name} / {Color}"            (color-only items, e.g. beanies)
//   "{Product Name} / {Size}"             (size-only items, e.g. stickers/dimensions)
//   "{Product Name}"                      (no variant axes at all)
//
// The first "/"-separated segment is ALWAYS the product name itself, never an
// attribute value — it must be dropped, not stored. Whatever segments remain
// are classified as color/size by pattern, not by fixed position, since some
// products only have one axis and it isn't always the same one.
const SIZE_TOKEN = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|6XL)$/i;
const SIZE_LIKE = /^\d+(\.\d+)?\s*(oz|ml|l|kg|g|lb|in|cm|mm)$/i;
const DIMENSION_LIKE = /\d+(\.\d+)?\s*["']?\s*[×x]\s*\d+/i;

function looksLikeSize(value: string): boolean {
  const v = value.trim();
  return SIZE_TOKEN.test(v) || SIZE_LIKE.test(v) || DIMENSION_LIKE.test(v);
}

function parseVariantAttributes(rawName: string): Record<string, string> {
  const rawParts = (rawName ?? "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

  // Drop the leading product-name segment. If there's nothing else, there
  // are no variant attributes to record.
  const parts = rawParts.slice(1);
  const attributes: Record<string, string> = {};

  if (parts.length === 0) {
    return attributes;
  }

  if (parts.length === 1) {
    // Single axis — could be color OR size depending on the product type.
    if (looksLikeSize(parts[0])) {
      attributes.size = parts[0];
    } else {
      attributes.color = parts[0];
    }
    return attributes;
  }

  // Two or more segments: convention is color first, then size, then any
  // further axes as option_N (N starting at 1 for the first extra axis).
  attributes.color = parts[0];
  attributes.size = parts[1];
  for (let i = 2; i < parts.length; i++) {
    attributes[`option_${i - 1}`] = parts[i];
  }

  return attributes;
}

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
          const listRes = await fetch(
            "https://api.printful.com/sync/products",
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );

          if (!listRes.ok) {
            return new Response(
              JSON.stringify({
                error: `Printful list error: ${listRes.status} ${listRes.statusText}`,
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
                {
                  headers: {
                    Authorization: `Bearer ${apiKey}`,
                  },
                }
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
                  const attributes = parseVariantAttributes(v.name ?? "");

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

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/printful-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
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
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        if (roleErr || !isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

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

        console.log(
          "FIRST PRODUCT:",
          result?.[0]
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
            // ─────────────────────────────────────────────
            // Fetch Product Detail
            // ─────────────────────────────────────────────
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

            // ─────────────────────────────────────────────
            // Product Name
            // ─────────────────────────────────────────────
            const productName =
              syncProduct.name ??
              item.name ??
              `product-${item.id}`;

            // ─────────────────────────────────────────────
            // Slug
            // ─────────────────────────────────────────────
            const slug = productName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");

            // ─────────────────────────────────────────────
            // Prices
            // ─────────────────────────────────────────────
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

            // ─────────────────────────────────────────────
            // Images
            // ─────────────────────────────────────────────
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

            // ─────────────────────────────────────────────
            // Variants
            // ─────────────────────────────────────────────
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

            // ─────────────────────────────────────────────
            // Debug Logs
            // ─────────────────────────────────────────────
            console.log(
              "UPSERTING PRODUCT:",
              {
                id: item.id,
                title: productName,
                slug,
                priceCents,
                imageCount:
                  imageUrls.length,
              }
            );

            // ─────────────────────────────────────────────
            // Upsert Product
            // ─────────────────────────────────────────────
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

                  // AUTO PUBLISH
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
              console.error(
                "UPSERT ERROR:",
                upsertError
              );

              errors.push(
                `Product ${item.id} (${productName}): ${upsertError.message}`
              );

              continue;
            }

            synced++;
          } catch (e: any) {
            console.error(
              `SYNC ERROR PRODUCT ${item.id}:`,
              e
            );

            errors.push(
              `Product ${item.id}: ${
                e.message ??
                "unknown error"
              }`
            );
          }
        }

        // ───────────────────────────────────────────────────────────
        // 4. Tombstone products no longer in Printful
        //    Any product in Supabase with a printful_id that did NOT
        //    appear in the live Printful catalog gets unpublished and
        //    archived automatically. This covers:
        //      • Products deleted from Printful
        //      • Products moved to draft in Printful
        //      • Products removed from the store
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
              console.log(
                `TOMBSTONED: ${p.title} (printful_id: ${p.printful_id})`
              );
            }
          }
        } else if (fetchErr) {
          console.error("TOMBSTONE FETCH ERROR:", fetchErr);
          tombstoneErrors.push(`Tombstone fetch failed: ${fetchErr.message}`);
        }

        // ───────────────────────────────────────────────────────────
        // 5. Response
        // ───────────────────────────────────────────────────────────
        return new Response(
          JSON.stringify({
            synced,
            total: result.length,
            tombstoned,
            errors: [...errors, ...tombstoneErrors],
          }),
          {
            status: 200,
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );
      },
    },
  },
});

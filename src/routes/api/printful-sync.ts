import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/printful-sync")({
  server: {
    handlers: {
      POST: async () => {
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
        // 4. Response
        // ───────────────────────────────────────────────────────────
        return new Response(
          JSON.stringify({
            synced,
            total: result.length,
            errors,
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

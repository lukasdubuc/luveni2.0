import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/printful-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // ── 1. Guard: key must exist before any fetch ──────────────────────
        const apiKey = process.env.Printful_API_Key;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Missing Printful_API_Key env var" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        // ── 2. Fetch product list from Printful ────────────────────────────
        const listRes = await fetch("https://api.printful.com/sync/products", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!listRes.ok) {
          return new Response(
            JSON.stringify({ error: `Printful list error: ${listRes.status} ${listRes.statusText}` }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }

        const { result } = await listRes.json() as { result: any[] };

        if (!result || result.length === 0) {
          return new Response(JSON.stringify({ synced: 0, message: "No products found in Printful store" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // ── 3. For each product, fetch full detail to get price & images ───
        let synced = 0;
        const errors: string[] = [];

        for (const item of result) {
          try {
            const detailRes = await fetch(`https://api.printful.com/sync/products/${item.id}`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (!detailRes.ok) {
              errors.push(`Product ${item.id}: Printful detail error ${detailRes.status}`);
              continue;
            }

            const { result: detail } = await detailRes.json() as { result: any };
            const syncVariants: any[] = detail.sync_variants ?? [];

            // Build slug from name
            const slug = (item.name as string)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");

            // Cheapest variant price (cents), default 0
            const priceCents =
              syncVariants.length > 0
                ? Math.min(
                    ...syncVariants
                      .map((v: any) => Math.round(parseFloat(v.retail_price ?? "0") * 100))
                      .filter((p: number) => p > 0)
                  )
                : 0;

            // Collect preview image URLs
            const imageUrls: string[] = Array.from(
              new Set(
                syncVariants
                  .map((v: any) => v.files?.find((f: any) => f.type === "preview")?.preview_url ?? "")
                  .filter(Boolean)
              )
            );
            if (imageUrls.length === 0 && item.thumbnail_url) {
              imageUrls.push(item.thumbnail_url);
            }

            // Build variants payload
            const variants = syncVariants.map((v: any) => {
              const parts = (v.name ?? "").split("/").map((p: string) => p.trim());
              const attributes: Record<string, string> = {};
              parts.forEach((part: string, i: number) => {
                if (i === 0) attributes["size"] = part;
                else if (i === 1) attributes["color"] = part;
                else attributes[`option_${i}`] = part;
              });
              return {
                sku: v.sku ?? String(v.id),
                price_cents: Math.round(parseFloat(v.retail_price ?? "0") * 100),
                external_sku: String(v.id),
                fulfillment_provider: "printful",
                attributes,
                stock: 999,
              };
            });

            // ── 4. Upsert into Supabase (conflict on printful_id) ──────────
            const { error: upsertError } = await supabaseAdmin
              .from("products")
              .upsert(
                {
                  title: item.name,
                  slug,
                  price_cents: priceCents,
                  image_urls: imageUrls,
                  is_archived: false,
                  is_published: false, // admin can publish manually after review
                  printful_id: String(item.id),
                  variants: variants.length > 0 ? variants : null,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "printful_id", ignoreDuplicates: false }
              );

            if (upsertError) {
              errors.push(`Product ${item.id} (${item.name}): ${upsertError.message}`);
            } else {
              synced++;
            }
          } catch (e: any) {
            errors.push(`Product ${item.id}: ${e.message ?? "unknown error"}`);
          }
        }

        return new Response(
          JSON.stringify({ synced, total: result.length, errors }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});

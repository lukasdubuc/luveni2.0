import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/product-add-or-update-webhook-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return new Response(JSON.stringify({ error: "Server misconfigured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          const body = await request.json();

          const apliqId = String(body.id || body.product_id || body.productId || body.design_id || "");
          if (!apliqId) {
            return new Response(JSON.stringify({ error: "Missing product identifier (id)" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const productName = body.name || body.title || `apliq-product-${apliqId}`;
          const description = body.description || body.external_name || productName;
          const slug = productName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

          let priceCents = 0;
          if (body.price_cents !== undefined) {
            priceCents = parseInt(body.price_cents);
          } else if (body.price !== undefined) {
            priceCents = Math.round(parseFloat(body.price) * 100);
          } else if (body.retail_price !== undefined) {
            priceCents = Math.round(parseFloat(body.retail_price) * 100);
          }

          let imageUrls = [];
          if (Array.isArray(body.image_urls)) {
            imageUrls = body.image_urls;
          } else if (Array.isArray(body.images)) {
            imageUrls = body.images.map(img => typeof img === "string" ? img : img.url || img.src || img.preview_url).filter(Boolean);
          } else if (body.image_url) {
            imageUrls = [body.image_url];
          } else if (body.thumbnail_url) {
            imageUrls = [body.thumbnail_url];
          }

          let variants = [];
          if (Array.isArray(body.variants)) {
            variants = body.variants.map(v => ({
              sku: v.sku || String(v.id || ""),
              price_cents: v.price_cents !== undefined ? parseInt(v.price_cents) : (v.price !== undefined ? Math.round(parseFloat(v.price) * 100) : priceCents),
              external_sku: String(v.id || v.sku || ""),
              fulfillment_provider: "apliq",
              attributes: v.attributes || { size: v.size || "OS", color: v.color || "Default" },
              stock: v.stock !== undefined ? v.stock : 999,
            }));
          } else if (body.sku) {
            variants = [{
              sku: body.sku,
              price_cents: priceCents,
              external_sku: body.sku,
              fulfillment_provider: "apliq",
              attributes: { size: "OS", color: "Default" },
              stock: 999,
            }];
          }

          if (priceCents === 0 && variants.length > 0) {
            const prices = variants.map(v => v.price_cents).filter(p => p > 0);
            if (prices.length > 0) {
              priceCents = Math.min(...prices);
            }
          }

          const { error: upsertError } = await supabaseAdmin
            .from("products")
            .upsert({
              title: productName,
              slug,
              description,
              price_cents: priceCents,
              image_urls: imageUrls,
              is_archived: false,
              is_published: true,
              apliq_id: apliqId,
              variants: variants.length > 0 ? variants : null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "apliq_id",
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error("APLIQ WEBHOOK UPSERT ERROR:", upsertError);
            return new Response(JSON.stringify({ error: upsertError.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ success: true, apliq_id: apliqId }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("APLIQ PRODUCT WEBHOOK EXCEPTION:", err);
          return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
  }
});
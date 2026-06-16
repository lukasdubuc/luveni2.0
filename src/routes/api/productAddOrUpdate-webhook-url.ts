import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/productAddOrUpdate-webhook-url")({
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

          // Safely map Apliq product payload structures
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

          // Resolve primary pricing indicators
          let priceCents = 0;
          if (body.price_cents !== undefined) {
            priceCents = parseInt(body.price_cents);
          } else if (body.price !== undefined) {
            priceCents = Math.round(parseFloat(body.price) * 100);
          } else if (body.retail_price !== undefined) {
            priceCents = Math.round(parseFloat(body.retail_price) * 100);
          }

          // Resolve image sets safely
          let imageUrls: string[] = [];
          if (Array.isArray(body.image_urls)) {
            imageUrls = body.image_urls;
          } else if (Array.isArray(body.images)) {
            imageUrls = body.images.map((img: any) => typeof img === "string" ? img : img.url || img.src || img.preview_url).filter(Boolean);
          } else if (body.image_url) {
            imageUrls = [body.image_url];
          } else if (body.thumbnail_url) {
            imageUrls = [body.thumbnail_url];
          }

          // Build item variants collection
          let variants: any[] = [];
          if (Array.isArray(body.variants)) {
            variants = body.variants.map((v: any) => ({
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

          // Fallback valuation from lowest variant price
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
        } catch (err: any) {
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
```

---

### File 4: Custom Search Webhook (`/productSearch-webhook-url`)

Create a new file in your routing system at `src/routes/productSearch-webhook-url.tsx` (or your project's server routes path) to serve as your "Product Search URL".

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/productSearch-webhook-url")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const search = url.searchParams.get("search") || "";

          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return new Response(JSON.stringify({ error: "Server misconfigured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

          const { data, error } = await supabaseAdmin
            .from("products")
            .select("*")
            .or(`title.ilike.%${search}%,apliq_id.eq.${search}`);

          if (error) {
            console.error("APLIQ DATABASE SEARCH ERROR:", error);
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Return directory listing in structured model matching Apliq custom store expectation
          const formatted = (data || []).map(p => ({
            id: p.apliq_id || p.id,
            title: p.title,
            name: p.title,
            price: p.price_cents / 100,
            sku: p.variants?.[0]?.sku || "",
            image_url: p.image_urls?.[0] || "",
            variants: (p.variants || []).map((v: any) => ({
              id: v.external_sku || v.sku,
              sku: v.sku,
              price: v.price_cents / 100,
              title: Object.values(v.attributes || {}).join(" / "),
            }))
          }));

          return new Response(JSON.stringify(formatted), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("APLIQ SEARCH PROCESS EXCEPTION:", err);
          return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
  }
});

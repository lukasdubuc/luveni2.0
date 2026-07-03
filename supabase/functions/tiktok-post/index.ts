// ─────────────────────────────────────────────────────────────
//  Luveni GM — tiktok-post (Supabase Edge Function)
//
//  Content Posting API (developers.tiktok.com): publish product photo
//  posts and videos to the Luveni TikTok account. The marketing arm of
//  the fleet — callable by admins (UI) or by Astra/workers (service key).
//
//  Actions:
//    { action: "creator_info" }                → posting limits/options
//    { action: "post_photo", product_id | image_urls[], title?,
//      description?, privacy?, post_mode? }    → photo carousel post
//    { action: "post_video", video_url, title?, privacy? }
//    { action: "status", publish_id }          → publish status fetch
//
//  Sandbox rules baked in: unaudited clients may only post SELF_ONLY —
//  that is the default privacy until the app passes review. Product
//  images are mirrored into the public `tiktok-media` storage bucket so
//  PULL_FROM_URL always fetches from our own verified domain (vendor
//  CDNs like cjdropshipping can't be domain-verified).
//
//  Every post is recorded in tiktok_posts for the fleet + admin UI.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { corsHeaders, json, requireAdmin, dbSelect, SUPABASE_URL, SERVICE_KEY } from "../_shared/http.ts";
import { isCronOrService } from "../_shared/cj.ts";
import { tkFetch } from "../_shared/tiktok.ts";
import { parseManufacturerMedia, selectTikTokImages, type NormalizedMedia } from "../_shared/media-pipeline.ts";

const BUCKET = "tiktok-media";
const svc = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

async function ensureBucket(): Promise<void> {
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  }).catch(() => {}); // 409 = already exists — fine
}

/** Mirror a remote image into our public bucket; returns the public URL. */
async function mirrorImage(url: string, keyHint: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const hash = Array.from(new Uint8Array(
      await crypto.subtle.digest("SHA-1", new TextEncoder().encode(url)),
    )).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    const path = `${keyHint}/${hash}.${ext}`;
    const put = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...svc(), "Content-Type": type, "x-upsert": "true" },
      body: await res.arrayBuffer(),
    });
    if (!put.ok && put.status !== 409) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  } catch { return null; }
}

/** Best ≤9 images for a product from product_media (fallback: image_urls). */
async function productImages(productId: string): Promise<{ images: string[]; title: string }> {
  const products = await dbSelect(`products?select=id,title,image_urls,raw_payload,source&id=eq.${productId}&limit=1`);
  const product = products[0];
  if (!product) throw new Error(`Product ${productId} not found`);

  const rows = await dbSelect(
    `product_media?select=variant_key,view_type,url,is_primary,is_transparent,position,source,metadata&product_id=eq.${productId}&order=position.asc`,
  );
  let media: NormalizedMedia[] = rows.map((r: any) => ({
    variantKey: r.variant_key, viewType: r.view_type, url: r.url,
    isPrimary: r.is_primary, isTransparent: r.is_transparent,
    position: r.position, source: r.source, metadata: r.metadata ?? {},
  }));
  if (!media.length && product.raw_payload) {
    media = parseManufacturerMedia(product.source, product.raw_payload);
  }
  const images = media.length ? selectTikTokImages(media) : (product.image_urls ?? []).slice(0, 9);
  if (!images.length) throw new Error(`Product ${productId} has no usable images`);
  return { images, title: product.title };
}

async function recordPost(row: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/tiktok_posts`, {
    method: "POST",
    headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isCronOrService(req))) {
    const authErr = await requireAdmin(req);
    if (authErr) return authErr;
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action ?? "creator_info";

  try {
    if (action === "creator_info") {
      const d = await tkFetch("/v2/post/publish/creator_info/query/");
      return json({ ok: true, creator: d?.data ?? null });
    }

    if (action === "post_photo") {
      let images: string[] = Array.isArray(body.image_urls) ? body.image_urls.filter(Boolean) : [];
      let defaultTitle = "";
      if (!images.length && body.product_id) {
        const p = await productImages(String(body.product_id));
        images = p.images;
        defaultTitle = p.title;
      }
      if (!images.length) return json({ error: "post_photo needs product_id or image_urls[]" }, 400);

      // Mirror onto our own domain unless the caller opts out.
      if (body.mirror !== false) {
        await ensureBucket();
        const mirrored = await Promise.all(images.map((u) => mirrorImage(u, body.product_id ?? "adhoc")));
        images = images.map((u, i) => mirrored[i] ?? u);
      }

      const title = String(body.title ?? defaultTitle ?? "").slice(0, 90);
      const description = String(body.description ?? "").slice(0, 4000);
      // Unaudited sandbox clients may ONLY post SELF_ONLY; flips to
      // PUBLIC_TO_EVERYONE after TikTok approves the app.
      const privacy = String(body.privacy ?? "SELF_ONLY");
      const postMode = String(body.post_mode ?? "DIRECT_POST"); // or MEDIA_UPLOAD → drafts to inbox

      const d = await tkFetch("/v2/post/publish/content/init/", {
        body: {
          post_info: {
            title,
            description,
            privacy_level: privacy,
            disable_comment: false,
            auto_add_music: true,
          },
          source_info: {
            source: "PULL_FROM_URL",
            photo_cover_index: 0,
            photo_images: images,
          },
          post_mode: postMode,
          media_type: "PHOTO",
        },
      });
      const publishId = d?.data?.publish_id ?? null;
      await recordPost({
        product_id: body.product_id ?? null, publish_id: publishId, post_type: "photo",
        title, privacy, post_mode: postMode, media: images, status: "submitted", raw: d,
      });
      return json({ ok: true, publish_id: publishId, images, privacy, post_mode: postMode });
    }

    if (action === "post_video") {
      const videoUrl = String(body.video_url ?? "");
      if (!videoUrl) return json({ error: "post_video needs video_url" }, 400);
      const title = String(body.title ?? "").slice(0, 2200);
      const privacy = String(body.privacy ?? "SELF_ONLY");

      const d = await tkFetch("/v2/post/publish/video/init/", {
        body: {
          post_info: {
            title,
            privacy_level: privacy,
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
        },
      });
      const publishId = d?.data?.publish_id ?? null;
      await recordPost({
        product_id: body.product_id ?? null, publish_id: publishId, post_type: "video",
        title, privacy, post_mode: "DIRECT_POST", media: [videoUrl], status: "submitted", raw: d,
      });
      return json({ ok: true, publish_id: publishId, privacy });
    }

    if (action === "status") {
      const publishId = String(body.publish_id ?? "");
      if (!publishId) return json({ error: "status needs publish_id" }, 400);
      const d = await tkFetch("/v2/post/publish/status/fetch/", { body: { publish_id: publishId } });
      const status = d?.data?.status ?? "UNKNOWN";
      await fetch(`${SUPABASE_URL}/rest/v1/tiktok_posts?publish_id=eq.${encodeURIComponent(publishId)}`, {
        method: "PATCH",
        headers: { ...svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status, raw: d, updated_at: new Date().toISOString() }),
      }).catch(() => {});
      return json({ ok: true, publish_id: publishId, status, detail: d?.data ?? null });
    }

    return json({ error: `Unknown action "${action}"` }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 502);
  }
});

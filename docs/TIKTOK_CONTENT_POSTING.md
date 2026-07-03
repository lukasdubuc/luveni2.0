# TikTok Content Posting — sandbox demo & app submission

The integration for **developers.tiktok.com** (Login Kit + Content Posting
API): posts product photos/videos to the Luveni TikTok **account**. This is
NOT TikTok Shop (commerce API — still blocked until the business has an EIN).

Client key: `awd1x02pwutsrvzz` (baked as the default; override with the
`TIKTOK_CLIENT_KEY` secret).

## Architecture

```
Admin → Settings → Integrations → "TikTok Content Posting"
   │ Connect
   ▼
tiktok-oauth (edge fn)      auth-code flow + CSRF state; tokens cached in
   │                        site_config.metadata.tiktok_auth (24h access /
   ▼                        365d refresh, auto-refreshed)
tiktok-post (edge fn)       creator_info · post_photo · post_video · status
   │                        product_id → best ≤9 images via product_media
   ▼                        (selectTikTokImages), mirrored into the public
tiktok_posts (table)        `tiktok-media` bucket so PULL_FROM_URL fetches
                            from our own verifiable domain
```

Both functions deploy with `verify_jwt = false` (see `supabase/config.toml`);
auth is enforced inside (admin JWT, service key, or `x-cron-key`) so the
luveni-ops fleet can post via the service key.

## One-time app configuration (developers.tiktok.com)

1. **Products**: add *Login Kit* and *Content Posting API* to the app.
2. **Scopes**: `user.info.basic`, `video.publish`, `video.upload`.
3. **Redirect URI** (Login Kit):
   `https://unitqfuetxedmmrvlocu.supabase.co/functions/v1/tiktok-oauth`
4. **Domain verification** (Content Posting → URL properties): verify
   `unitqfuetxedmmrvlocu.supabase.co` so `PULL_FROM_URL` media is accepted.
   (Vendor CDNs can't be verified — that's why tiktok-post mirrors images
   into our storage bucket first.)
5. **Secrets** (Supabase → Edge Functions → Secrets, or the admin panel):
   `TIKTOK_CLIENT_SECRET` (required), `TIKTOK_CLIENT_KEY` (optional override).

## Sandbox demo (pre-approval)

Unaudited clients can only create **SELF_ONLY** (private) posts — the
functions default to that, so the sandbox flow is exactly the production
flow with a private audience:

1. In the TikTok developer console, create a **Sandbox** for the app and add
   your own TikTok account as a target user.
2. Admin → Settings → Integrations → TikTok Content Posting → save the
   sandbox client secret → **Connect** → authorize with the target account.
3. Post a photo carousel for any imported product:

```bash
curl -X POST "https://unitqfuetxedmmrvlocu.supabase.co/functions/v1/tiktok-post" \
  -H "Authorization: Bearer <admin-jwt-or-service-key>" \
  -H "Content-Type: application/json" \
  -d '{"action":"post_photo","product_id":"<uuid>","title":"New drop at Luveni","description":"Shop link in bio #luveni"}'
```

4. Poll `{"action":"status","publish_id":"..."}` until `PUBLISH_COMPLETE`,
   then confirm the private post exists in the TikTok app.

## App-review submission checklist

- Record a screen capture of the full loop: Connect (OAuth consent) →
  post_photo → status → the post visible in TikTok. That video is the demo
  TikTok review asks for.
- Explain the use case as: "Luveni (e-commerce storefront) posts its own
  product photos/videos to its own TikTok account on a schedule."
- After approval, pass `"privacy":"PUBLIC_TO_EVERYONE"` (the default stays
  SELF_ONLY so nothing accidental goes public before then).

## Where this goes next (fleet)

`tiktok-post` is deliberately callable with the service key so a luveni-ops
worker (marketing agent) can own the cadence: pick products (new imports,
bestsellers), generate captions/hashtags, post, then track `tiktok_posts`
status — no human in the loop once the app is approved.

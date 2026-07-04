-- ─────────────────────────────────────────────────────────────
--  Hands-off TikTok Shop inventory sync.
--
--  cj-inventory-sync (*/30) refreshes products.variants[].stock from CJ.
--  This pushes that fresh stock to the matching TikTok Shop listings 10
--  minutes later (offset so it always sends current numbers), so listings
--  CJ created with 0 quantity self-heal to the real stock with no human in
--  the loop.
--
--  The edge function is a NO-OP until the TikTok Shop secrets are set
--  (TIKTOK_SHOP_APP_KEY / _APP_SECRET / _ACCESS_TOKEN / _CIPHER), so
--  scheduling it now is harmless and it goes live the moment the seller
--  connects their approved TikTok Shop app. Idempotent.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  perform cron.unschedule('tiktok-shop-inventory-sync-30min');
exception when others then null;
end $$;

select cron.schedule(
  'tiktok-shop-inventory-sync-30min',
  '10,40 * * * *',
  $cron$
  select net.http_post(
    url:='https://unitqfuetxedmmrvlocu.supabase.co/functions/v1/tiktok-shop-inventory-sync',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-key', coalesce((select metadata->>'cron_key' from site_config where id='main'), '')
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=150000
  );
  $cron$
);

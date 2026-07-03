-- ─────────────────────────────────────────────────────────────
--  Server-side transparent-PNG enforcement.
--
--  The strip-background / strip-background-sweep edge functions turn any
--  vendor product's primary image (CJ / Printful / Apliiq JPGs on white)
--  into a background-removed transparent PNG via a hosted API, mirroring
--  the browser CjTransparencyPanel. This schedules the sweep every 15
--  minutes so newly-imported products converge to a transparent primary
--  with no human in the loop. Idempotent.
--
--  The engine is a NO-OP until a provider secret is set — set exactly one
--  of REMOVE_BG_API_KEY (api.remove.bg, free ~50/mo) or PHOTOROOM_API_KEY
--  on the Edge Function secrets to switch enforcement on.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  perform cron.unschedule('strip-background-sweep-15min');
exception when others then null;
end $$;

select cron.schedule(
  'strip-background-sweep-15min',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url:='https://unitqfuetxedmmrvlocu.supabase.co/functions/v1/strip-background-sweep',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-key', coalesce((select metadata->>'cron_key' from site_config where id='main'), '')
    ),
    body:=jsonb_build_object('limit', 5),
    timeout_milliseconds:=150000
  );
  $cron$
);

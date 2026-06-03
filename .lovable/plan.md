## Goal

Make the metrics on `/admin` (Overview cards + Analytics charts/stats) update **live** as new orders, leads, page_events, products, and admin_users land in the database — no manual refresh, no broken behavior.

## Why it's not live today

`src/routes/admin.index.tsx` calls `fetchData()` exactly once on mount (line 213). All KPIs (revenue, orders, leads, page views, product clicks, checkout starts, funnel, top referrers/pages/products, sessions, country breakdown) are derived via `useMemo` from local state arrays. Nothing re-fetches until the user reloads.

Also, only `site_config` is in the Supabase `supabase_realtime` publication — the other tables can't emit realtime events even if we subscribe.

## Scope

Only `src/routes/admin.index.tsx` is edited, plus one DB migration to enable realtime on the relevant tables. No other files touched. No UI/visual changes. No changes to fetch/save/Printful/auth logic.

## Changes

### 1. DB migration — enable realtime publication

Add the admin-relevant tables to `supabase_realtime` (idempotent, safe on re-run):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_users;
ALTER TABLE public.orders     REPLICA IDENTITY FULL;
ALTER TABLE public.leads      REPLICA IDENTITY FULL;
ALTER TABLE public.products   REPLICA IDENTITY FULL;
ALTER TABLE public.page_events REPLICA IDENTITY FULL;
ALTER TABLE public.admin_users REPLICA IDENTITY FULL;
```

(Each `ALTER PUBLICATION … ADD TABLE` guarded with a check so re-running doesn't error.)

RLS already restricts these tables to admins, so realtime payloads are only delivered to authenticated admins — no data leak.

### 2. `src/routes/admin.index.tsx` — add a single realtime effect

Add one new `useEffect` (right after the existing init effect at line 213) that subscribes to all five tables on a single channel and updates the existing React state arrays incrementally. No new state, no new types, no refactor of existing logic.

Behavior per table:
- **orders / leads / products / admin_users**: handle `INSERT` (prepend to array), `UPDATE` (replace by id), `DELETE` (filter out by id). This keeps every existing `useMemo` (revenue, funnel, KPI cards) automatically correct because they all derive from these arrays.
- **page_events**: handle `INSERT` only (prepend, cap at 5000 to match the initial fetch's `.limit(5000)`). This drives the Analytics page views / product clicks / checkout starts / sessions / referrers / top pages / countries.

Cleanup unsubscribes the channel on unmount.

Resilience: if the websocket drops, on `SUBSCRIBED` re-event we call the existing `fetchData()` once to reconcile any missed rows. No new fetch function needed.

### 3. Tiny UX touch (optional, no visual change)

Nothing visual changes. The existing "last updated" / range controls keep working.

## What is NOT changing

- No edits to `Header`, `Footer`, `SiteShell`, routing, auth, theme bootstrap, Printful sync, save handlers, RLS policies, or any other route file.
- No new dependencies.
- No change to the initial fetch or its `limit(5000)` cap.
- No changes to the UI markup, classes, or styling — purely a data-freshness change.

## Verification

1. Open `/admin` Overview in one tab.
2. In another tab/window, place a test order (or insert a row via the existing checkout flow) → the orders count, revenue, and recent orders list update within ~1s without refresh.
3. Submit the lead form on the public site → leads count ticks up live.
4. Browse any public page → Analytics "Page Views" increments live; referrer/top-pages lists reflect it.
5. Edit a product from another admin session → product list updates in place.
6. Kill network briefly, restore → channel re-subscribes and `fetchData()` reconciles.

## Technical Notes

- Channel name: `admin_realtime` (single channel, multiple `.on('postgres_changes', …)` handlers — cheaper than one channel per table).
- Filter: none at the DB level (admins see everything; RLS handles authorization).
- The `page_events` cap mirrors the existing query so memory stays bounded under heavy traffic.
- Effect dependency array is `[]` so the channel persists for the whole admin session; cleanup runs on unmount.

# Admin Portal + Stripe Checkout

Builds a secure owner-only dashboard and wires real Stripe payments. The public site keeps its current design.

## 1. Database

New migration:
- `products` table — id, slug, title, description, price_cents, currency, image_urls (text[]), source_url, fulfillment_notes, is_published, created_at/updated_at
- `app_role` enum (`admin`, `user`) + `user_roles` table (user_id, role) with `has_role(uuid, app_role)` SECURITY DEFINER function
- Add `product_id` (nullable FK) to `orders`
- RLS:
  - `products`: public can SELECT where `is_published = true`; admins can do everything
  - `orders`, `leads`: admins can SELECT all; existing public can't read
  - `user_roles`: users can read their own; only admins can write

## 2. Auth

- Enable email/password (no auto-confirm) + Google sign-in (`configure_social_auth`)
- `/login` page — Supabase email/password + Google button via Lovable broker
- `_authenticated` layout route guards `/admin/*` with `beforeLoad` session check
- A second check in the admin layout calls `has_role(uid, 'admin')` and shows a "Not authorized" state if not admin
- First user to sign up gets admin role assigned via a one-time SQL insert the user runs (we'll surface the instruction)

## 3. Admin portal (`/admin/*`)

Sidebar layout (shadcn sidebar) with these routes:
- `/admin` — Revenue dashboard (total revenue, order count, recent orders, recent leads)
- `/admin/orders` — table of orders with status, customer, email, product, amount, payment status; status update dropdown
- `/admin/leads` — table of contact/email submissions
- `/admin/products` — list + create/edit/delete; publish toggle; manual form (title, slug, price, description, images as comma-separated URLs, fulfillment notes, source URL); "Import from URL" button calls a server fn that fetches the URL, runs through Lovable AI (`google/gemini-2.5-flash`) to extract title/description/price/image and prefills the form
- `/admin/settings` — basic settings (logout, account email)

All admin data access goes through `createServerFn` + `requireSupabaseAuth` + `has_role` check inside handler.

## 4. Stripe wiring (user's own key)

- Request `STRIPE_SECRET_KEY` via `add_secret`
- Install `stripe` package
- Rewrite `createCheckout` server fn:
  - Insert pending order (link to product if product_id provided)
  - Create Stripe Checkout Session (price_data from offer or product)
  - Save `provider_ref = session.id`, `provider = 'stripe'`
  - Return `redirectUrl = session.url`
- Add `/api/public/stripe-webhook` server route: verify signature with `STRIPE_WEBHOOK_SECRET`, update order status to `paid`/`failed` on `checkout.session.completed` / `*.expired`
- Thank-you page reads order by id and shows status

## 5. Public site changes

- Checkout form unchanged visually; on submit it now redirects to Stripe
- Homepage / offer page: if any published products exist later they could be listed, but for now the single `offer` config remains the default. No public redesign.

## Technical notes

- Use `supabaseAdmin` only for webhook (verified) and the URL-import fetch
- All admin reads use the authenticated supabase client + RLS (admins-can-read policies do the gating)
- "Import from URL": fetch HTML server-side, strip to text, send to Lovable AI with a JSON-schema-style prompt; fall back gracefully if parse fails — manual form is always primary
- Need two secrets from user: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (webhook secret can be added after they create the webhook endpoint in Stripe dashboard)
- After deploy, user needs to: (1) sign up, (2) we'll show them the SQL to promote themselves to admin, (3) add Stripe webhook in dashboard pointing to `/api/public/stripe-webhook`

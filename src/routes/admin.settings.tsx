import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";
import { IntegrationsSettings } from "@/components/admin/IntegrationsSettings";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: requireAdmin,
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        <p className="mt-2 text-sm text-muted-foreground">Signed in as {email ?? "…"}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Stripe webhook</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Point Stripe webhook at:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
          {typeof window !== "undefined" ? window.location.origin : ""}/api/public/stripe-webhook
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          Listen for: checkout.session.completed, checkout.session.expired,
          checkout.session.async_payment_failed.
        </p>
      </div>
      <IntegrationsSettings />

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Brand &amp; copy</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Brand name, default offer copy and FAQ live in <code className="rounded bg-muted px-1 py-0.5 text-xs">src/config/site.ts</code>.
          Edit that file to re-skin the public site for any niche.
        </p>
      </div>
      <IntegrationsSettings />
    </div>
  );
}

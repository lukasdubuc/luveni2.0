import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";
import { AdminIntegrations } from "@/components/admin/AdminIntegrations";
import { AdminPricing } from "@/components/admin/AdminPricing";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: requireAdmin,
  component: SettingsPage,
});

type AdminUser = {
  id: string;
  email: string;
  role: "admin" | "manager" | "viewer";
  created_at: string;
};

function useIsDark() {
  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function SettingsPage() {
  const isDark = useIsDark();
  const [email, setEmail] = useState<string | null>(null);

  // ── Product sync ──────────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);
  const handleSyncProducts = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("printful-sync", { body: {} });
      if (error) { toast.error(error.message || "Sync failed"); return; }
      if (data?.error) { toast.error(data.error); return; }
      if (Array.isArray(data?.errors) && data.errors.length > 0) { toast.error(data.errors[0]); return; }
      const tombMsg = data?.tombstoned ? ` Removed ${data.tombstoned} no longer on Printful.` : "";
      toast.success(`Sync complete: ${data?.synced || 0}/${data?.total || 0} product(s) processed.${tombMsg}`);
    } catch (e: any) {
      toast.error(`Sync error: ${e?.message || "Unknown error"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const [testingDiscord, setTestingDiscord] = useState(false);
  const handleTestDiscord = async () => {
    setTestingDiscord(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-notify", {
        body: {
          title: "✅ Discord connected",
          message: "Astra can reach this channel. Alerts for orders, fulfillment and inventory will arrive here, sir.",
          level: "success",
          source: "test",
        },
      });
      if (error) {
        let detail = error.message || "Discord test failed";
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try { const body = await ctx.json(); if (body?.error) detail = body.error; }
          catch { try { detail = await ctx.text(); } catch { /* ignore */ } }
        }
        toast.error(detail);
        return;
      }
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Test alert sent to Discord.");
    } catch (e: any) {
      toast.error(`Discord error: ${e?.message || "Unknown error"}`);
    } finally {
      setTestingDiscord(false);
    }
  };

  // ── Admin users (team) ────────────────────────────────────────
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AdminUser["role"]>("manager");

  const loadAdminUsers = async () => {
    const { data } = await supabase.from("admin_users").select("*").order("created_at", { ascending: true });
    setAdminUsers((data ?? []) as AdminUser[]);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    loadAdminUsers();
  }, []);

  const handleAddAdminUser = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) { toast.error("Enter an email"); return; }
    const { error } = await supabase.from("admin_users").insert([{ email: trimmed, role: newRole }]);
    if (error) { toast.error(error.message); return; }
    setNewEmail("");
    toast.success(`${trimmed} added as ${newRole}.`);
    await loadAdminUsers();
  };

  const handleRemoveAdminUser = async (id: string) => {
    const { error } = await supabase.from("admin_users").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await loadAdminUsers();
  };

  const handleUpdateUserRole = async (id: string, role: AdminUser["role"]) => {
    const { error } = await supabase.from("admin_users").update({ role }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await loadAdminUsers();
  };

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        <p className="mt-2 text-sm text-muted-foreground">Signed in as {email ?? "…"}</p>
      </div>

      {/* ── Sync & alerts ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Catalog sync &amp; alerts</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pull the latest products from Printful, and verify the Discord alert channel.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleSyncProducts}
            disabled={isSyncing}
            className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background transition hover:opacity-80 disabled:opacity-40"
          >
            {isSyncing ? "Syncing…" : "Sync products"}
          </button>
          <button
            onClick={handleTestDiscord}
            disabled={testingDiscord}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition hover:bg-muted disabled:opacity-40"
          >
            {testingDiscord ? "Sending…" : "Test Discord"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Stripe webhook</h2>
        <p className="mt-2 text-sm text-muted-foreground">Point Stripe webhook at:</p>
        <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
          {typeof window !== "undefined" ? window.location.origin : ""}/api/public/stripe-webhook
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          Listen for: checkout.session.completed, checkout.session.expired,
          checkout.session.async_payment_failed.
        </p>
      </div>

      {/* ── Pricing ── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Pricing</h2>
        <AdminPricing isDark={isDark} />
      </div>

      {/* ── Integrations ── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Integrations</h2>
        <AdminIntegrations isDark={isDark} />
      </div>

      {/* ── Team / admin users ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Team access</h2>
        <p className="mt-2 text-sm text-muted-foreground">Who can reach the admin dashboard.</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="flex-1 min-w-[200px] rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:border-foreground focus:outline-none"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AdminUser["role"])}
            className="rounded-lg border border-border bg-transparent px-2 py-2 text-sm"
          >
            <option value="admin">admin</option>
            <option value="manager">manager</option>
            <option value="viewer">viewer</option>
          </select>
          <button
            onClick={handleAddAdminUser}
            className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background transition hover:opacity-80"
          >
            Add
          </button>
        </div>

        <ul className="mt-4 divide-y divide-border">
          {adminUsers.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="truncate">{u.email}</span>
              <span className="flex items-center gap-2">
                <select
                  value={u.role}
                  onChange={(e) => handleUpdateUserRole(u.id, e.target.value as AdminUser["role"])}
                  className="rounded border border-border bg-transparent px-1.5 py-1 text-xs"
                >
                  <option value="admin">admin</option>
                  <option value="manager">manager</option>
                  <option value="viewer">viewer</option>
                </select>
                <button
                  onClick={() => handleRemoveAdminUser(u.id)}
                  className="text-xs uppercase tracking-widest text-red-500 opacity-70 hover:opacity-100"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
          {adminUsers.length === 0 && (
            <li className="py-2 text-xs uppercase tracking-widest text-muted-foreground">No admin users yet</li>
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Brand &amp; copy</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Brand name, default offer copy and FAQ live in <code className="rounded bg-muted px-1 py-0.5 text-xs">src/config/site.ts</code>.
          Edit that file to re-skin the public site for any niche.
        </p>
      </div>
    </div>
  );
}
